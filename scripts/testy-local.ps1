param(
  [switch]$SkipNpmInstall,
  [switch]$UseNpmCi,
  [bool]$IncludeUnitTests = $true
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
  $nodeModulesPath = Join-Path $repoRoot "node_modules"

  if ($UseNpmCi) {
    Write-Host "Installing npm dependencies (npm ci)..."
    & $npmCmd ci
  } elseif (-not (Test-Path $nodeModulesPath)) {
    Write-Host "node_modules not found, installing npm dependencies (npm install)..."
    & $npmCmd install
  } else {
    Write-Host "node_modules already present; skipping npm install."
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed with exit code $LASTEXITCODE."
  }
}

if ($IncludeUnitTests) {
  Write-Host "Running unit tests..."
  & $npmCmd run test:unit
  if ($LASTEXITCODE -ne 0) {
    throw "Unit tests failed with exit code $LASTEXITCODE."
  }
}

Write-Host "Running API contract tests..."
& $npmCmd run test:api-contract
if ($LASTEXITCODE -ne 0) {
  throw "Contract tests failed with exit code $LASTEXITCODE."
}

Write-Host "Tests finished successfully."
