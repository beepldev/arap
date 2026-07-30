@echo off
cd /d "%~dp0"
set PORT=8789
set HOST=0.0.0.0
title Team Brother Project Management App - Network Server

echo Starting Team Brother Project Management App in NETWORK mode...
echo Folder: %cd%
echo Server computer URL: http://127.0.0.1:%PORT%
echo Other PCs must open: http://SERVER-IP:%PORT%
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

echo Finding this server computer IP address...
ipconfig | findstr /i "IPv4"
echo.
echo Use the IPv4 address shown above on other PCs, for example:
echo http://192.168.1.10:%PORT%
echo.
echo If Windows Firewall asks permission, click Allow Access for Private Network.
echo.

start "" "http://127.0.0.1:%PORT%"
python server.py

echo.
echo App stopped. Press any key to close.
pause >nul
