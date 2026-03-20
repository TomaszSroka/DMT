# Function to display SQL file list with color and exclusion note

param(
  [switch]$apply,
  [switch]$list,
  [string]$SqlDir
)
$ErrorActionPreference = "Stop"

function Show-SqlFileList {
    param(
        [array]$folders
    )
    Write-Host "******************************"
    Write-Host "DBeaver scripts directory: $dbeaverScriptsRoot"
    Write-Host "******************************"
    Write-Host "Files to process (folder -> file):"
    foreach ($folder in $folders) {
        $files = Get-ChildItem -Path $folder.FullName -File -Filter *.sql | Sort-Object Name
        if ($files.Count -gt 0) {
            Write-Host "  $($folder.Name):"
            foreach ($file in $files) {
                if ($file.Name -like '*_CHECK_*') {
                    Write-Host ("    * " + $file.Name + " (excluded)") -ForegroundColor DarkGray
                } else {
                    Write-Host ("    * " + $file.Name) -ForegroundColor Yellow
                }
            }
        }
    }
    Write-Host "******************************"
    Write-Host ""
}


# DBeaver scripts location
$dbeaverScriptsRoot = "C:\Users\tomas\AppData\Roaming\DBeaverData\workspace6\01_1 DMT\Scripts"
if (-not (Test-Path $dbeaverScriptsRoot)) {
    throw "DBeaver scripts directory not found: $dbeaverScriptsRoot"
}

# Find snowsql
$snowsqlCmd = $null
$snowsql = Get-Command snowsql -ErrorAction SilentlyContinue
if ($snowsql) {
    $snowsqlCmd = $snowsql.Source
} else {
    throw "snowsql is not available. Install SnowSQL CLI and ensure it is in PATH."
}

function Resolve-DmtConfigJson {
    if (-not [string]::IsNullOrWhiteSpace($env:DMT_CONFIG_JSON)) {
        return $env:DMT_CONFIG_JSON
    }
    $scriptPath = $MyInvocation.MyCommand.Path
    $repoRoot = if ($null -eq $scriptPath -or $scriptPath -eq "") { $PWD.Path } else { Split-Path $scriptPath -Parent }
    $envFile = Join-Path $repoRoot ".env"
    if (-not (Test-Path $envFile)) {
        throw "DMT_CONFIG_JSON is not set and .env file was not found at $envFile"
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

# Get all SQL files from DBeaver folders, sorted
$folders = Get-ChildItem -Path $dbeaverScriptsRoot -Directory | Sort-Object Name
$sqlFiles = @()
foreach ($folder in $folders) {
    $files = Get-ChildItem -Path $folder.FullName -File -Filter *.sql | Sort-Object Name
    foreach ($file in $files) {
        $sqlFiles += $file
    }
}

if ($list) {
    Show-SqlFileList -folders $folders
    exit 0
}

if (-not $apply) {
    Write-Host "USAGE:"
    Write-Host "  .\\local-run-db.ps1 -list      # Show files only"
    Write-Host "  .\\local-run-db.ps1 -apply     # Execute SQL files"
    exit 0
}

# Parse config
$configJson = Resolve-DmtConfigJson
$config = $null
try {
    $config = $configJson | ConvertFrom-Json
} catch {
    throw "Failed to parse DMT_CONFIG_JSON as JSON. $_"
}

$requiredConfigKeys = @(
    "SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_ROLE", "SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_DATABASE", "SNOWFLAKE_SCHEMA"
)
$missing = @()
foreach ($key in $requiredConfigKeys) {
    if (-not $config.PSObject.Properties.Name.Contains($key) -or [string]::IsNullOrWhiteSpace([string]$config.$key)) {
        $missing += $key
    }
}
if ($missing.Count -gt 0) {
    throw "Missing required DMT_CONFIG_JSON keys for DB scripts: $($missing -join ', ')"
}

$privateKeyPath = if ($config.PSObject.Properties.Name.Contains("SNOWFLAKE_PRIVATE_KEY_PATH")) { [string]$config.SNOWFLAKE_PRIVATE_KEY_PATH } else { "" }
$privateKeyPassphrase = if ($config.PSObject.Properties.Name.Contains("SNOWFLAKE_PRIVATE_KEY_PASSPHRASE")) { [string]$config.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE } else { "" }
# Handle ${ENV_VAR} substitution for passphrase
if ($privateKeyPassphrase -match '^\$\{(.+)\}$') {
    $envVar = $Matches[1]
    $envValue = [Environment]::GetEnvironmentVariable($envVar)
    if ([string]::IsNullOrWhiteSpace($envValue)) {
        # Try to get from .env file
        $repoRoot = $PWD.Path
        $envFile = Join-Path $repoRoot ".env"
        if (Test-Path $envFile) {
            $envLine = Get-Content -Path $envFile | Where-Object { $_ -match "^\s*${envVar}\s*=" } | Select-Object -First 1
            if ($envLine) {
                $envValueFromFile = $envLine -replace "^\s*${envVar}\s*=\s*", ''
                if (-not [string]::IsNullOrWhiteSpace($envValueFromFile)) {
                    $privateKeyPassphrase = $envValueFromFile.Trim()
                } else {
                    throw "SNOWFLAKE_PRIVATE_KEY_PASSPHRASE points to variable '$envVar', but its value in .env is empty."
                }
            } else {
                throw "SNOWFLAKE_PRIVATE_KEY_PASSPHRASE points to variable '$envVar', but it is not set in environment or .env file."
            }
        } else {
            throw "SNOWFLAKE_PRIVATE_KEY_PASSPHRASE points to variable '$envVar', but it is not set in environment and .env file does not exist."
        }
    } else {
        $privateKeyPassphrase = $envValue
    }
}

if (-not $sqlFiles -or $sqlFiles.Count -eq 0) {
    throw "No SQL files found in DBeaver scripts directory."
}

# Prepare SnowSQL connection options
$connectionOptions = @(
    "-a", [string]$config.SNOWFLAKE_ACCOUNT,
    "-u", [string]$config.SNOWFLAKE_USER,
    "-r", [string]$config.SNOWFLAKE_ROLE,
    "-w", [string]$config.SNOWFLAKE_WAREHOUSE,
    "-d", [string]$config.SNOWFLAKE_DATABASE,
    "-s", [string]$config.SNOWFLAKE_SCHEMA,
    "-o", "exit_on_error=true",
    "-o", "friendly=false",
    "-o", "timing=false",
    "-o", "header=false"
)
if (-not [string]::IsNullOrWhiteSpace($privateKeyPath)) {
    $connectionOptions += @("--private-key-path", $privateKeyPath)
}

Write-Host "****************************** EXECUTING SCRIPTS ******************************"
foreach ($file in $sqlFiles) {
    if ($file.Name -like '*_CHECK_*') {
        continue
    }
    Write-Host "******************************"
    Write-Host ("[SCRIPT] " + $file.Directory.Name + "/" + $file.Name) -ForegroundColor Yellow
    Write-Host "******************************"
    $commandLine = New-Object System.Collections.Generic.List[string]
    $null = $commandLine.Add("-f")
    $null = $commandLine.Add('"' + $file.FullName + '"')
    foreach ($option in $connectionOptions) {
        $null = $commandLine.Add([string]$option)
    }

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $snowsqlCmd
    $startInfo.Arguments = [string]::Join(' ', $commandLine)
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    if (-not [string]::IsNullOrWhiteSpace($privateKeyPassphrase)) {
        $startInfo.Environment["SNOWSQL_PRIVATE_KEY_PASSPHRASE"] = $privateKeyPassphrase
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    $process.Start() | Out-Null
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    Write-Host $stdout
    if ($stderr) { Write-Host $stderr }

    if ($process.ExitCode -ne 0) {
        throw "Execution failed for file '$($file.Directory.Name)/$($file.Name)' with exit code $($process.ExitCode)"
    }
}

Write-Host "******************************"
Write-Host "All database scripts executed successfully." -ForegroundColor Green
Write-Host "******************************"
Write-Host ""
