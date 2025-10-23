@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Move to the directory of this script (the repo root)
cd /d "%~dp0"

REM Detect or create venv: prefer .venv, then venv; create .venv if neither exists
set "VENV_DIR="
if exist ".venv\Scripts\python.exe" set "VENV_DIR=.venv"
if not defined VENV_DIR if exist "venv\Scripts\python.exe" set "VENV_DIR=venv"
if not defined VENV_DIR (
  echo [setup] Creating virtual environment .venv ...
  where py >nul 2>nul
  if %ERRORLEVEL%==0 (
    py -3 -m venv .venv
  ) else (
    python -m venv .venv
  )
  if errorlevel 1 (
    echo [error] Failed to create .venv
    exit /b 1
  )
  set "VENV_DIR=.venv"
)

set "PYEXE=%VENV_DIR%\Scripts\python.exe"
if not exist "%PYEXE%" (
  echo [error] Python not found in %VENV_DIR%
  exit /b 1
)

echo [setup] Upgrading pip and installing requirements ...
"%PYEXE%" -m pip install -U pip setuptools wheel
if exist "requirements.txt" (
  "%PYEXE%" -m pip install -r requirements.txt
)

echo [run] Launching crossPrint UI ...
"%PYEXE%" "app.py"

endlocal
