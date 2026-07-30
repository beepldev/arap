#!/bin/zsh
cd "$(dirname "$0")"
LOG_FILE="./start-app.log"
PORT="${PORT:-8789}"
LAN_IP=$(python3 -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0]); s.close()" 2>/dev/null)

clear
echo "Starting Team Brother Project Management App..."
echo "Folder: $(pwd)"
echo "App URL: http://127.0.0.1:${PORT}"
if [ -n "$LAN_IP" ] && [ "$LAN_IP" != "127.0.0.1" ]; then
  echo "On this network: http://${LAN_IP}:${PORT}"
fi
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
