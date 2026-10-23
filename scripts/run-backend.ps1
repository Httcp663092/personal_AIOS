$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
# Developer mode only. Set the same token on your HTTP client.
if (-not $env:PERSONALAI_TOKEN) { throw "Set PERSONALAI_TOKEN to a random session token first." }
& .venv/Scripts/python.exe backend/main.py --port 18765
