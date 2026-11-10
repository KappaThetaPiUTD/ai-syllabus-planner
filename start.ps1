# Starts the backend (port 8000) and frontend (port 3000) in two new windows.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path "$root\backend\.venv")) {
    Write-Host "Setting up Python environment..."
    python -m venv "$root\backend\.venv"
    & "$root\backend\.venv\Scripts\pip.exe" install -r "$root\backend\requirements.txt"
}
if (-not (Test-Path "$root\backend\.env")) { Copy-Item "$root\backend\.env.example" "$root\backend\.env" }
if (-not (Test-Path "$root\frontend\node_modules")) {
    Write-Host "Installing frontend packages..."
    Push-Location "$root\frontend"; npm install; Pop-Location
}
if (-not (Test-Path "$root\frontend\.env.local")) { Copy-Item "$root\frontend\.env.local.example" "$root\frontend\.env.local" }

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"
Write-Host "Backend:  http://localhost:8000/docs"
Write-Host "Frontend: http://localhost:3000"
