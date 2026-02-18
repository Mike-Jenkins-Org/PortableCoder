$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$qemuExe = Join-Path $repoRoot 'runtime\qemu\qemu-system-x86_64.exe'
$vmImage = Join-Path $repoRoot 'runtime\linux\images\ubuntu.qcow2'
$stateDir = Join-Path $repoRoot 'state\vm'
$vmLog = Join-Path $stateDir 'qemu.log'
$vmErrLog = Join-Path $stateDir 'qemu.err.log'
$vmPid = Join-Path $stateDir 'qemu.pid'
$vmMode = Join-Path $stateDir 'qemu-mode.txt'
$sshPortFile = Join-Path $stateDir 'ssh-port.txt'

if (-not (Test-Path $stateDir)) {
  New-Item -ItemType Directory -Path $stateDir | Out-Null
}

if (-not (Test-Path $qemuExe)) {
  throw "Missing QEMU binary: $qemuExe"
}

if (-not (Test-Path $vmImage)) {
  throw "Missing VM image: $vmImage"
}

function Get-FreeTcpPort {
  param(
    [int]$StartPort = 2222,
    [int]$EndPort = 2299
  )

  for ($port = $StartPort; $port -le $EndPort; $port++) {
    $listener = $null
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
      $listener.Start()
      $listener.Stop()
      return $port
    } catch {
      if ($listener) {
        try { $listener.Stop() } catch {}
      }
    }
  }

  throw "No free TCP port found in range $StartPort-$EndPort"
}

if (Test-Path $vmPid) {
  $existingPid = (Get-Content $vmPid -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($existingPid) {
    $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existingProcess) {
      if (-not (Test-Path $sshPortFile)) {
        throw "VM appears running (pid: $existingPid) but missing SSH port file: $sshPortFile"
      }
      Write-Host "VM already running (pid: $existingPid)."
      exit 0
    }
  }

  Remove-Item $vmPid -ErrorAction SilentlyContinue
  Remove-Item $vmMode -ErrorAction SilentlyContinue
  Remove-Item $sshPortFile -ErrorAction SilentlyContinue
}

$requestedPortRaw = $env:PCODER_VM_SSH_PORT
$sshPort = 0
if ($requestedPortRaw) {
  $sshPort = [int]$requestedPortRaw
} else {
  $sshPort = Get-FreeTcpPort
}

$baseArgs = @(
  '-m', '4096',
  '-smp', '2',
  '-drive', "file=$vmImage,if=virtio,format=qcow2",
  '-netdev', "user,id=net0,hostfwd=tcp::$sshPort-:22",
  '-device', 'virtio-net-pci,netdev=net0'
)

function Start-QemuAttempt {
  param(
    [string]$Mode,
    [string[]]$AccelerationArgs,
    [string[]]$BaseArgs,
    [string]$QemuBinary,
    [string]$LogPath
  )

  "[$(Get-Date -Format o)] launch mode: $Mode" | Out-File -Encoding utf8 -FilePath $LogPath
  $args = @() + $AccelerationArgs + $BaseArgs
  $process = Start-Process -FilePath $QemuBinary -ArgumentList $args -PassThru -WindowStyle Hidden -RedirectStandardOutput $LogPath -RedirectStandardError $vmErrLog

  Start-Sleep -Seconds 3
  $process.Refresh()
  if ($process.HasExited) {
    return $null
  }

  return $process
}

$accelerated = Start-QemuAttempt -Mode 'accelerated-whpx' -AccelerationArgs @('-accel', 'whpx') -BaseArgs $baseArgs -QemuBinary $qemuExe -LogPath $vmLog
if ($accelerated) {
  $accelerated.Id | Out-File -Encoding ascii -FilePath $vmPid
  'accelerated-whpx' | Out-File -Encoding ascii -FilePath $vmMode
  $sshPort | Out-File -Encoding ascii -FilePath $sshPortFile
  Write-Host "VM started in accelerated mode (whpx). PID: $($accelerated.Id). SSH port: $sshPort"
  exit 0
}

$fallback = Start-QemuAttempt -Mode 'portable-fallback-tcg' -AccelerationArgs @('-accel', 'tcg') -BaseArgs $baseArgs -QemuBinary $qemuExe -LogPath $vmLog
if ($fallback) {
  $fallback.Id | Out-File -Encoding ascii -FilePath $vmPid
  'portable-fallback-tcg' | Out-File -Encoding ascii -FilePath $vmMode
  $sshPort | Out-File -Encoding ascii -FilePath $sshPortFile
  Write-Host "VM started in portable fallback mode (tcg). PID: $($fallback.Id). SSH port: $sshPort"
  exit 0
}

throw "Failed to start VM in both accelerated (whpx) and fallback (tcg) modes. Check log: $vmLog"
