#!/bin/bash
set -e

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
MAGENTA='\033[0;35m'; BOLD='\033[1m'; RESET='\033[0m'

clear
echo -e "${BOLD}${MAGENTA}"
echo "  ███╗   ███╗███████╗██╗      ██████╗ ██████╗  █████╗ ██╗"
echo "  ████╗ ████║██╔════╝██║     ██╔═══██╗██╔══██╗██╔══██╗██║"
echo "  ██╔████╔██║█████╗  ██║     ██║   ██║██║  ██║███████║██║"
echo "  ██║╚██╔╝██║██╔══╝  ██║     ██║   ██║██║  ██║██╔══██║██║"
echo "  ██║ ╚═╝ ██║███████╗███████╗╚██████╔╝██████╔╝██║  ██║██║"
echo "  ╚═╝     ╚═╝╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝"
echo -e "${RESET}"

# Get script directory (so it works when called from anywhere)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Install dependencies if missing ─────────────────────────────────────
if [ ! -d "node_modules" ]; then
    echo -e "${CYAN}[1/3] Installing root packages...${RESET}"
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo -e "${GREEN}[2/3] Installing backend packages...${RESET}"
    (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${MAGENTA}[3/3] Installing frontend packages...${RESET}"
    (cd frontend && npm install)
fi

echo ""
echo -e "${BOLD}All dependencies ready!${RESET}"
echo ""
echo -e "  ${CYAN}AI Service${RESET}  → http://localhost:8000"
echo -e "  ${GREEN}Backend${RESET}     → http://localhost:5000"
echo -e "  ${MAGENTA}Frontend${RESET}    → http://localhost:5173"
echo ""
echo -e "Press ${BOLD}Ctrl+C${RESET} to stop all services."
echo ""

# ── Start all 3 via concurrently ────────────────────────────────────────
npx concurrently \
  --names "AI,BACKEND,FRONTEND" \
  --prefix-colors "cyan,green,magenta" \
  --kill-others-on-fail \
  "cd ai-service && uvicorn main:app --host 0.0.0.0 --port 8000 --reload" \
  "cd backend && npx nodemon server.js" \
  "cd frontend && npx vite"
