#!/bin/zsh
cd "$(dirname "$0")"
LOG_FILE="./check-app.log"

clear
echo "Checking Team Brother Project Management App..."
echo "Folder: $(pwd)"
echo "Log file: ${LOG_FILE}"
echo ""

{
  echo "==== Check attempt: $(date) ===="
  echo "Folder: $(pwd)"
  echo "Python path: $(command -v python3)"
  python3 --version
  echo ""
  echo "Checking port 8789:"
  lsof -i tcp:8789 || echo "Port 8789 is free"
  echo ""
  echo "Checking Python syntax:"
  PYTHONPYCACHEPREFIX=/private/tmp/project-app-pycache python3 -m py_compile server.py
  echo "Python syntax OK"
  echo ""
  echo "Checking database folder:"
  ls -ld data
  echo ""
  echo "Check completed."
} 2>&1 | tee "${LOG_FILE}"

echo ""
echo "If there is any error above, send the contents of check-app.log."
echo "Press Enter to close this window."
read
