param(
  [switch]$SkipNpmInstall,
  [switch]$UseNpmCi,
  [bool]$IncludeUnitTests = $true
)

  # --- DMT_CONFIG_JSON multiline loader ---
  function Resolve-DmtConfigJson {
    $scriptPath = $MyInvocation.MyCommand.Path
    $repoRoot = if ($null -eq $scriptPath -or $scriptPath -eq "") { $PWD.Path } else { Split-Path $scriptPath -Parent }
    $envFile = Join-Path $repoRoot ".env"
    if (-not (Test-Path $envFile)) {
      throw ".env file was not found at $envFile"
    }
    $lines = Get-Content -Path $envFile
    $startIdx = $lines | Select-String -Pattern '^\s*DMT_CONFIG_JSON\s*=\s*' | Select-Object -First 1 | ForEach-Object { $_.LineNumber - 1 }
    if ($null -eq $startIdx) {
      throw "DMT_CONFIG_JSON entry not found in $envFile"
    }
    $jsonLines = @()
    $foundStart = $false
    for ($i = $startIdx; $i -lt $lines.Count; $i++) {
      $line = $lines[$i]
      if (-not $foundStart) {
        $json = ($line -replace '^\s*DMT_CONFIG_JSON\s*=\s*', '')
        if ($json -match '^\s*\{') {
          $jsonLines += $json
          $foundStart = $true
          if ($json -match '\}\s*$') { break } # single-line JSON
        }
      } else {
        $jsonLines += $line
        if ($line -match '^\s*\}') { break }
      }
    }
    if ($jsonLines.Count -eq 0) {
      throw "Could not extract DMT_CONFIG_JSON block from $envFile"
    }
    return ($jsonLines -join "`n")
  }

  $env:DMT_CONFIG_JSON = Resolve-DmtConfigJson

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
      Write-Host "[WARNING] Dependency installation failed with exit code $LASTEXITCODE, continuing with tests."
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
