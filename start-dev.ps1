param(
    [ValidateSet("rendr-app", "CADAM")]
    [string]$MainProject = "rendr-app"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$mainPath = Join-Path $repoRoot $MainProject
$apiPath = Join-Path $repoRoot "rendr-api"

if (-not (Test-Path $mainPath)) {
    throw "Main project folder not found: $mainPath"
}

if (-not (Test-Path $apiPath)) {
    throw "API folder not found: $apiPath"
}

$mainCommand = "Set-Location '$mainPath'; npm run dev"

$venvActivate = Join-Path $apiPath ".venv\Scripts\activate.ps1"
if (Test-Path $venvActivate) {
    $apiCommand = "Set-Location '$apiPath'; & '$venvActivate'; uvicorn rendr_api.main:app --reload"
} else {
    $apiCommand = "Set-Location '$apiPath'; uvicorn rendr_api.main:app --reload"
}

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $mainCommand
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $apiCommand

Write-Host "Started $MainProject dev server and rendr-api in separate terminals."
