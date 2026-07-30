#!/bin/zsh
cd "$(dirname "$0")"
LOG_FILE="./start-network-app.log"
PORT="${PORT:-8789}"
HOST="${HOST:-0.0.0.0}"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)"

clear
echo "Starting Team Brother Project Management App in NETWORK mode..."
echo "Folder: $(pwd)"
echo "Server computer URL: http://127.0.0.1:${PORT}"
echo "Other PCs on same network open: http://${LAN_IP}:${PORT}"
echo "Login: admin / admin123"
echo "Log file: ${LOG_FILE}"
echo ""

{
  echo "==== Network start attempt: $(date) ===="
  echo "Folder: $(pwd)"
  echo "Python: $(command -v python3)"
  python3 --version
  echo "Host: ${HOST}"
  echo "Port: ${PORT}"
  echo "LAN URL: http://${LAN_IP}:${PORT}"
  echo ""
  HOST="${HOST}" PORT="${PORT}" python3 server.py
} 2>&1 | tee "${LOG_FILE}"

echo ""
echo "If other PCs cannot open the app, check firewall and use the LAN URL above."
echo "Press Enter to close this window."
read
