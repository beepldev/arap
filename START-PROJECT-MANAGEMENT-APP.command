#!/bin/zsh
cd "$(dirname "$0")"
LOG_FILE="./start-app.log"
PORT="${PORT:-8789}"

clear
echo "Starting Team Brother Project Management App..."
echo "Folder: $(pwd)"
echo "App URL: http://127.0.0.1:${PORT}"
echo "Login: admin / admin123"
echo "Log file: ${LOG_FILE}"
echo ""

{
  echo "==== Start attempt: $(date) ===="
  echo "Folder: $(pwd)"
  echo "Python: $(command -v python3)"
  python3 --version
  echo "Port: ${PORT}"
  echo ""
  PORT="${PORT}" python3 server.py
} 2>&1 | tee "${LOG_FILE}"

echo ""
echo "If the app did not start, send the contents of start-app.log."
echo "Press Enter to close this window."
read
