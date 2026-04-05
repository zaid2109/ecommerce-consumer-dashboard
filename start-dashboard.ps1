param(
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $appDir

function Pause-IfNeeded {
  if (-not $NoPause) {
    Write-Host ''
    Read-Host 'Press Enter to continue' | Out-Null
  }
}

function Stop-StaleProcesses {
  Write-Host '[1/6] Killing stale Next.js + port 3000 processes...'

  $nextTargets = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'node.exe' -and (
      $_.CommandLine -like "*$appDir*next*" -or
      $_.CommandLine -match 'next\\dist\\server\\lib\\start-server\\.js'
    )
  }

  foreach ($t in $nextTargets) {
    try { Stop-Process -Id $t.ProcessId -Force -ErrorAction Stop } catch {}
  }

  try {
    $listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop
    foreach ($listener in $listeners) {
      if ($listener.OwningProcess -gt 0) {
        try { Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop } catch {}
      }
    }
  } catch {}

  Start-Sleep -Seconds 1
}

function Start-And-Validate {
  Write-Host '[4/6] Starting dashboard on fixed port 3000...'
  $proc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--port','3000' -WorkingDirectory $appDir -PassThru

  Write-Host '[5/6] Waiting for dashboard + CSS health...'
  $healthy = $false
  for ($i = 0; $i -lt 150; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri 'http://localhost:3000/dashboard' -UseBasicParsing -TimeoutSec 5
      if ($resp.StatusCode -eq 200) {
        $m = [regex]::Match($resp.Content, '/_next/static/css/app/layout\.css\?v=\d+')
        if ($m.Success) {
          $css = Invoke-WebRequest -Uri ('http://localhost:3000' + $m.Value) -UseBasicParsing -TimeoutSec 5
          if ($css.StatusCode -eq 200 -and $css.Content -match '\.sc\s*\{' -and $css.Content -match '\.nav-link\s*\{') {
            $healthy = $true
            break
          }
        }
      }
    } catch {}
    Start-Sleep -Milliseconds 800
  }

  if (-not $healthy) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch {}
  }

  return $healthy
}

$hadError = $false

try {
  Write-Host '=================================================='
  Write-Host '  EcoDash Startup (Stable + Self-Heal)'
  Write-Host '=================================================='
  Write-Host ''

  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm is not installed or not in PATH.'
  }

  Stop-StaleProcesses

  Write-Host '[2/6] Clearing Next.js cache...'
  if (Test-Path '.next') {
    Remove-Item '.next' -Recurse -Force
  }

  Write-Host '[3/6] Installing dependencies if needed...'
  if (-not (Test-Path 'node_modules')) {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
  }

  $healthy = Start-And-Validate

  if (-not $healthy) {
    Write-Host 'First launch health-check failed. Retrying once with clean cache...'
    Stop-StaleProcesses
    if (Test-Path '.next') { Remove-Item '.next' -Recurse -Force }
    $healthy = Start-And-Validate
  }

  if (-not $healthy) {
    throw 'Server started but style health check failed after retry. Close all terminals and run start-dashboard.bat again.'
  }

  Write-Host '[6/6] Opening dashboard...'
  Start-Process 'http://localhost:3000/dashboard' | Out-Null
  Write-Host ''
  Write-Host 'SUCCESS: Dashboard is healthy and styled.'
  Write-Host 'URL: http://localhost:3000/dashboard'
  Write-Host ''
  exit 0
}
catch {
  $hadError = $true
  Write-Host ('[ERROR] ' + $_.Exception.Message)
  exit 1
}
finally {
  Pause-IfNeeded
}
