@echo off
setlocal
cd /d "%~dp0"
if defined PYTHON_EXE (
  "%PYTHON_EXE%" app.py
  goto finished
)
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" app.py
  goto finished
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys;sys.exit(sys.version_info < (3,11))" >nul 2>nul
  if not errorlevel 1 (py -3 app.py & goto finished)
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys;sys.exit(sys.version_info < (3,11))" >nul 2>nul
  if not errorlevel 1 (python app.py & goto finished)
)
echo Python 3.11+ is required. Install it manually or set PYTHON_EXE to its full path.
exit /b 1
:finished
if errorlevel 1 pause
