# Run from a Windows 11 x64 developer machine. No tests are executed.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if ($env:OS -ne "Windows_NT") { throw "Windows native build required." }
foreach ($tool in @("py", "node", "npm.cmd", "cargo", "rustc")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing prerequisite: $tool. See README.md" }
}
function Run-Checked([string]$Program, [string[]]$Arguments) {
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}
Run-Checked "py" @("-3.11", "-m", "venv", ".venv")
$python = Join-Path $PWD ".venv\Scripts\python.exe"
Run-Checked $python @("-m", "pip", "install", "-r", "backend/requirements.txt", "pyinstaller==6.13.0")
Run-Checked $python @("-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--noconsole", "--name", "personalai-backend", "--collect-submodules", "uvicorn", "backend/main.py")
$hostLine = (& rustc -vV | Select-String '^host:').ToString()
$target = $hostLine.Split(' ')[1]
if ($target -ne "x86_64-pc-windows-msvc") { throw "Use x64 Rust MSVC toolchain for the target laptop." }
New-Item -ItemType Directory -Force src-tauri/binaries | Out-Null
Copy-Item dist/personalai-backend.exe "src-tauri/binaries/personalai-backend-$target.exe" -Force
if (Test-Path package-lock.json) { Run-Checked "npm.cmd" @("ci") }
else { Run-Checked "npm.cmd" @("install") }
Run-Checked "npm.cmd" @("run", "build", "--", "--bundles", "nsis")
$setup = Get-ChildItem src-tauri/target/release/bundle/nsis/*-setup.exe | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) { throw "NSIS installer not found" }
New-Item -ItemType Directory -Force release | Out-Null
Copy-Item $setup.FullName release/PersonalAIOS-Setup.exe -Force
Get-FileHash release/PersonalAIOS-Setup.exe -Algorithm SHA256 | Format-List
Write-Host "Built release/PersonalAIOS-Setup.exe (unsigned; not runtime-tested)."
