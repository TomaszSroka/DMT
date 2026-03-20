# Skrypt do czyszczenia logów aplikacji DMT
$projectRoot = Split-Path $MyInvocation.MyCommand.Path -Parent
$logsDir = Join-Path $projectRoot "..\logs"
$logFiles = @()
$logFiles += Join-Path $logsDir "snowflake.log"
$logFiles += Join-Path $logsDir "sql-queries.log"
foreach ($file in $logFiles) {
    if (Test-Path $file) {
        Clear-Content $file
        Write-Host "Wyczyszczono: $file"
    } else {
        Write-Host "Nie znaleziono: $file"
    }
}
