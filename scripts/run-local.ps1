param(
  [switch]$Restart,
  [bool]$AutoFreePort = $true,
  [switch]$ForceKillAnyProcessOnPort,
  [switch]$UseDevServer,
  [int]$Port = 3000,
  [string]$Url = "http://localhost:3000",
  [int]$WindowScalePercent = 70,
  [switch]$NoWindowTweaks
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

$npmCmd = $null
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($npm) {
  $npmCmd = $npm.Source
} elseif (Test-Path "C:\Program Files\nodejs\npm.cmd") {
  $npmCmd = "C:\Program Files\nodejs\npm.cmd"
} else {
  throw "npm is not available. Install Node.js LTS first."
}

function Get-ProcessCommandLine {
  param(
    [int]$ProcessId
  )

  try {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
    return [string]$proc.CommandLine
  } catch {
    return ""
  }
}

function Stop-ListeningProcessesOnPort {
  param(
    [int]$TargetPort,
    [string]$RepoPath,
    [bool]$AllowForceKillAnyProcess
  )

  $listeners = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
  if (-not $listeners) {
    return @{ Success = $true; Blocked = @() }
  }

  $blocked = @()
  $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      $commandLine = Get-ProcessCommandLine -ProcessId $processId
      $name = [string]$process.ProcessName
      $isNodeProcess = $name -match "^(node|npm|npx)$"
      $isRepoProcess = -not [string]::IsNullOrWhiteSpace($commandLine) -and $commandLine.Contains([string]$RepoPath)

      if ($AllowForceKillAnyProcess -or ($isNodeProcess -and $isRepoProcess)) {
        Write-Host "Stopping process on port ${TargetPort}: PID=$processId Name=$name"
        Stop-Process -Id $processId -Force -ErrorAction Stop
      } else {
        $blocked += [PSCustomObject]@{
          ProcessId = $processId
          Name = $name
          CommandLine = $commandLine
        }
      }
    } catch {
      Write-Host "Could not stop process ${processId}: $($_.Exception.Message)"
    }
  }

  Start-Sleep -Seconds 1
  $remaining = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
  if (-not $remaining) {
    return @{ Success = $true; Blocked = @() }
  }

  return @{ Success = $false; Blocked = $blocked }
}

if ($Restart -or $AutoFreePort) {
  $stopResult = Stop-ListeningProcessesOnPort -TargetPort $Port -RepoPath $repoRoot -AllowForceKillAnyProcess $ForceKillAnyProcessOnPort
  if (-not $stopResult.Success) {
    if ($stopResult.Blocked.Count -gt 0 -and -not $ForceKillAnyProcessOnPort) {
      Write-Host "Processes on port $Port were not stopped because they are not recognized as this repo's Node processes:"
      $stopResult.Blocked | ForEach-Object {
        Write-Host "  PID=$($_.ProcessId) Name=$($_.Name)"
      }
      throw "Port $Port remains in use. Use -ForceKillAnyProcessOnPort to force kill any listener."
    }

    throw "Port $Port is still in use after stop attempt. Close the process manually and try again."
  }
}

$scale = [Math]::Min([Math]::Max($WindowScalePercent, 40), 100)
$npmScript = if ($UseDevServer) { "dev" } else { "start" }
$noWindowTweaksLiteral = if ($NoWindowTweaks) { '$true' } else { '$false' }
$startCommand = @"

if (-not $noWindowTweaksLiteral) {
  `$raw = `$Host.UI.RawUI
  `$current = `$raw.WindowSize
  `$newWidth = [Math]::Max(60, [int]([Math]::Floor(`$current.Width * ($scale / 100.0))))
  `$newHeight = [Math]::Max(16, [int]([Math]::Floor(`$current.Height * ($scale / 100.0))))
  `$buffer = `$raw.BufferSize
  if (`$buffer.Width -lt `$newWidth) { `$buffer.Width = `$newWidth }
  if (`$buffer.Height -lt `$newHeight) { `$buffer.Height = `$newHeight }
  `$raw.BufferSize = `$buffer
  `$raw.WindowSize = New-Object Management.Automation.Host.Size(`$newWidth, `$newHeight)
}

Set-Location -Path '$repoRoot'
& '$npmCmd' run $npmScript
"@

if (-not ("ConsoleWinApi" -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class ConsoleWinApi {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);
}
"@
}

$psProcess = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $startCommand -PassThru

for ($i = 0; $i -lt 25 -and $psProcess.MainWindowHandle -eq 0; $i++) {
  Start-Sleep -Milliseconds 100
  $psProcess.Refresh()
}

if ($psProcess.MainWindowHandle -ne 0 -and -not $NoWindowTweaks) {
  $rect = New-Object ConsoleWinApi+RECT
  if ([ConsoleWinApi]::GetWindowRect($psProcess.MainWindowHandle, [ref]$rect)) {
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    $screenWidth = [ConsoleWinApi]::GetSystemMetrics(0)
    $screenHeight = [ConsoleWinApi]::GetSystemMetrics(1)
    $x = [Math]::Max(0, [int](($screenWidth - $width) / 2))
    $y = [Math]::Max(0, [int](($screenHeight - $height) / 2))
    [ConsoleWinApi]::MoveWindow($psProcess.MainWindowHandle, $x, $y, $width, $height, $true) | Out-Null
  }
}

Start-Sleep -Seconds 2

$firefoxCmd = $null
$firefox = Get-Command firefox -ErrorAction SilentlyContinue
if ($firefox) {
  $firefoxCmd = $firefox.Source
} elseif (Test-Path "C:\Program Files\Mozilla Firefox\firefox.exe") {
  $firefoxCmd = "C:\Program Files\Mozilla Firefox\firefox.exe"
} elseif (Test-Path "C:\Program Files (x86)\Mozilla Firefox\firefox.exe") {
  $firefoxCmd = "C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
}

if ($firefoxCmd) {
  Start-Process -FilePath $firefoxCmd -ArgumentList "-new-window", $Url | Out-Null
} else {
  Write-Host "Firefox not found, opening in default browser instead."
  Start-Process $Url | Out-Null
}

Write-Host "App start command sent. Browser opened at $Url"
Write-Host "Run mode: npm run $npmScript"
Write-Host "Port cleanup: AutoFreePort=$AutoFreePort, Restart=$Restart, ForceKillAnyProcessOnPort=$ForceKillAnyProcessOnPort"
Write-Host "Tip: use -UseDevServer for watch mode, -NoWindowTweaks for simpler startup, and -ForceKillAnyProcessOnPort only when needed."
