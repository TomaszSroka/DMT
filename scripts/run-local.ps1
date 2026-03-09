param(
  [switch]$Restart,
  [int]$Port = 3000,
  [string]$Url = "http://localhost:3000",
  [int]$WindowScalePercent = 70
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

if ($Restart) {
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($listeners) {
    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pidItem in $pids) {
      try {
        Stop-Process -Id $pidItem -Force -ErrorAction Stop
      } catch {
        Write-Host "Could not stop process ${pidItem}: $($_.Exception.Message)"
      }
    }
    Start-Sleep -Seconds 1
  }
}

$scale = [Math]::Min([Math]::Max($WindowScalePercent, 40), 100)
$startCommand = @"

`$raw = `$Host.UI.RawUI
`$current = `$raw.WindowSize
`$newWidth = [Math]::Max(60, [int]([Math]::Floor(`$current.Width * ($scale / 100.0))))
`$newHeight = [Math]::Max(16, [int]([Math]::Floor(`$current.Height * ($scale / 100.0))))
`$buffer = `$raw.BufferSize
if (`$buffer.Width -lt `$newWidth) { `$buffer.Width = `$newWidth }
if (`$buffer.Height -lt `$newHeight) { `$buffer.Height = `$newHeight }
`$raw.BufferSize = `$buffer
`$raw.WindowSize = New-Object Management.Automation.Host.Size(`$newWidth, `$newHeight)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WinApi {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("kernel32.dll")]
  public static extern IntPtr GetConsoleWindow();

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);
}
'@ -ErrorAction SilentlyContinue

`$hWnd = [WinApi]::GetConsoleWindow()
if (`$hWnd -ne [IntPtr]::Zero) {
  `$rect = New-Object WinApi+RECT
  if ([WinApi]::GetWindowRect(`$hWnd, [ref]`$rect)) {
    `$width = `$rect.Right - `$rect.Left
    `$height = `$rect.Bottom - `$rect.Top
    `$screenWidth = [WinApi]::GetSystemMetrics(0)
    `$screenHeight = [WinApi]::GetSystemMetrics(1)
    `$x = [Math]::Max(0, [int]((`$screenWidth - `$width) / 2))
    `$y = [Math]::Max(0, [int]((`$screenHeight - `$height) / 2))
    [WinApi]::MoveWindow(`$hWnd, `$x, `$y, `$width, `$height, `$true) | Out-Null
  }
}

Set-Location -Path '$repoRoot'
& '$npmCmd' start
"@
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $startCommand | Out-Null

Start-Sleep -Seconds 2
Start-Process $Url | Out-Null

Write-Host "App start command sent. Browser opened at $Url"
Write-Host "Tip: use -Restart to stop current app on port $Port before starting again."
