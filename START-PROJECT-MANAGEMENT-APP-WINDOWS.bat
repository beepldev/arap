@echo off
cd /d "%~dp0"
set PORT=8789
title Team Brother Project Management App

echo Starting Team Brother Project Management App...
echo Folder: %cd%
echo App URL: http://127.0.0.1:%PORT%
echo Login: admin / admin123
echo.

python --version >nul 2>&1
if errorlevel 1 (
  echo Python is not installed or not added to PATH.
  echo.
  echo Step 1: Install Python 3 from https://www.python.org/downloads/
  echo Step 2: During installation tick "Add python.exe to PATH".
  echo Step 3: Run this file again.
  echo.
  start https://www.python.org/downloads/
  pause
  exit /b 1
)

start "" "http://127.0.0.1:%PORT%"
python server.py

echo.
echo App stopped. Press any key to close.
pause >nul
