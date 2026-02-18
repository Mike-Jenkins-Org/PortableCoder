$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$qemuExe = Join-Path $repoRoot 'runtime\qemu\qemu-system-x86_64.exe'
$vmImage = Join-Path $repoRoot 'runtime\linux\images\ubuntu.qcow2'
$sshPrivateKey = Join-Path $repoRoot 'runtime\linux\ssh\id_ed25519'
$sshPublicKey = Join-Path $repoRoot 'runtime\linux\ssh\id_ed25519.pub'
$metaDataTemplate = Join-Path $repoRoot 'runtime\linux\cloud-init\meta-data'
$cloudInitServerScript = Join-Path $repoRoot 'scripts\runtime\windows\cloud-init-server.ps1'

$stateDir = Join-Path $repoRoot 'state\vm'
$vmLog = Join-Path $stateDir 'qemu.log'
$vmErrLog = Join-Path $stateDir 'qemu.err.log'
$vmPid = Join-Path $stateDir 'qemu.pid'
$vmMode = Join-Path $stateDir 'qemu-mode.txt'
$sshPortFile = Join-Path $stateDir 'ssh-port.txt'

$cloudInitStateDir = Join-Path $stateDir 'cloud-init'
$cloudInitUserDataPath = Join-Path $cloudInitStateDir 'user-data'
$cloudInitMetaDataPath = Join-Path $cloudInitStateDir 'meta-data'
$cloudInitPidFile = Join-Path $stateDir 'cloud-init-http.pid'
$cloudInitPortFile = Join-Path $stateDir 'cloud-init-port.txt'

function Ensure-Dir {
  param([string]$PathToCreate)
  if (-not (Test-Path $PathToCreate)) {
    New-Item -ItemType Directory -Path $PathToCreate -Force | Out-Null
  }
}

function Get-FreeTcpPort {
  param(
    [int]$StartPort,
    [int]$EndPort
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

function Stop-CloudInitServer {
  if (Test-Path $cloudInitPidFile) {
    $raw = Get-Content $cloudInitPidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($raw) {
      $pidValue = "$raw".Trim()
      if ($pidValue) {
        Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
      }
    }
  }

  Remove-Item $cloudInitPidFile -ErrorAction SilentlyContinue
  Remove-Item $cloudInitPortFile -ErrorAction SilentlyContinue
}

function Write-CloudInitSeed {
  param(
    [string]$PublicKey,
    [string]$UserName
  )

  Ensure-Dir $cloudInitStateDir

  $metaData = "instance-id: portable-coder-vm`nlocal-hostname: portable-coder`n"
  if (Test-Path $metaDataTemplate) {
    $metaData = Get-Content $metaDataTemplate -Raw
    if (-not $metaData.Trim()) {
      $metaData = "instance-id: portable-coder-vm`nlocal-hostname: portable-coder`n"
    }
  }
  $metaData | Out-File -Encoding ascii -FilePath $cloudInitMetaDataPath

  $userData = @"
#cloud-config
users:
  - name: $UserName
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    lock_passwd: true
    groups:
      - sudo
    ssh_authorized_keys:
      - $PublicKey
ssh_pwauth: false
"@
  $userData | Out-File -Encoding utf8 -FilePath $cloudInitUserDataPath
}

function Start-CloudInitServer {
  param(
    [int]$Port
  )

  $args = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $cloudInitServerScript,
    '-Port', "$Port",
    '-Directory', $cloudInitStateDir
  )
  $proc = Start-Process -FilePath 'powershell' -ArgumentList $args -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 1
  $proc.Refresh()
  if ($proc.HasExited) {
    throw "cloud-init HTTP server failed to start (exit code: $($proc.ExitCode))."
  }

  $proc.Id | Out-File -Encoding ascii -FilePath $cloudInitPidFile
  $Port | Out-File -Encoding ascii -FilePath $cloudInitPortFile
}

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

Ensure-Dir $stateDir

if (-not (Test-Path $qemuExe)) {
  throw "Missing QEMU binary: $qemuExe`nRun scripts\runtime\windows\bootstrap-runtime.cmd first."
}
if (-not (Test-Path $vmImage)) {
  throw "Missing VM image: $vmImage`nRun scripts\runtime\windows\bootstrap-runtime.cmd first."
}
if (-not (Test-Path $sshPrivateKey) -or -not (Test-Path $sshPublicKey)) {
  throw "Missing VM SSH key pair: $sshPrivateKey`nRun scripts\runtime\windows\bootstrap-runtime.cmd first."
}
if (-not (Test-Path $cloudInitServerScript)) {
  throw "Missing cloud-init server script: $cloudInitServerScript"
}

if (Test-Path $vmPid) {
  $existingPidRaw = Get-Content $vmPid -ErrorAction SilentlyContinue | Select-Object -First 1
  $existingPid = "$existingPidRaw".Trim()
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

Stop-CloudInitServer

$requestedPortRaw = $env:PCODER_VM_SSH_PORT
$sshPort = 0
if ($requestedPortRaw) {
  $sshPort = [int]$requestedPortRaw
} else {
  $sshPort = Get-FreeTcpPort -StartPort 2222 -EndPort 2299
}

$cloudInitPort = Get-FreeTcpPort -StartPort 38080 -EndPort 38120
$guestUser = if ($env:PCODER_VM_USER) { $env:PCODER_VM_USER } else { 'portable' }
$pubKeyValue = (Get-Content $sshPublicKey -Raw).Trim()
Write-CloudInitSeed -PublicKey $pubKeyValue -UserName $guestUser
Start-CloudInitServer -Port $cloudInitPort

$baseArgs = @(
  '-m', '4096',
  '-smp', '2',
  '-drive', "file=$vmImage,if=virtio,format=qcow2",
  '-netdev', "user,id=net0,hostfwd=tcp::$sshPort-:22",
  '-device', 'virtio-net-pci,netdev=net0',
  '-smbios', "type=1,serial=ds=nocloud-net;s=http://10.0.2.2:$cloudInitPort/"
)

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

Stop-CloudInitServer
throw "Failed to start VM in both accelerated (whpx) and fallback (tcg) modes. Check log: $vmLog"
