param(
  [switch]$SkipNpmInstall
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

Set-Location -Path $repoRoot

if (-not $SkipNpmInstall) {
  Write-Host "Installing npm dependencies (npm install)..."
  & $npmCmd install
  if ($LASTEXITCODE -ne 0) {
    throw "npm install failed with exit code $LASTEXITCODE."
  }
}

Write-Host "Running API contract tests..."
& $npmCmd run test:api-contract
if ($LASTEXITCODE -ne 0) {
  throw "Contract tests failed with exit code $LASTEXITCODE."
}

Write-Host "Contract tests finished successfully."
