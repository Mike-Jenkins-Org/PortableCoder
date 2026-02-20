param()

$ErrorActionPreference = 'Stop'

$startVmPath = Join-Path $PSScriptRoot 'start-vm.ps1'
if (-not (Test-Path $startVmPath)) {
  throw "Missing target script: $startVmPath"
}

$text = Get-Content -Path $startVmPath -Raw -Encoding UTF8
$marker = 'Preferred cloud-init port range 38080-38120 unavailable; using ephemeral port $cloudInitPort.'

if ($text.Contains($marker)) {
  Write-Host "Patch already present in $startVmPath"
  exit 0
}

$oldLine = '$cloudInitPort = Get-FreeTcpPort -StartPort 38080 -EndPort 38120'
$replacement = @'
$cloudInitPort = 0
try {
  $cloudInitPort = Get-FreeTcpPort -StartPort 38080 -EndPort 38120
} catch {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  try {
    $listener.Start()
    $cloudInitPort = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
  } finally {
    try { $listener.Stop() } catch {}
  }
  Write-Host "Preferred cloud-init port range 38080-38120 unavailable; using ephemeral port $cloudInitPort."
}
'@

if (-not $text.Contains($oldLine)) {
  throw "Could not find expected line to patch in $startVmPath"
}

$updated = $text.Replace($oldLine, $replacement)
Set-Content -Path $startVmPath -Value $updated -Encoding UTF8

Write-Host "Applied cloud-init port fallback patch to $startVmPath"

