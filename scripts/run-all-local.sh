#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

P1_ENV_FILE="$ROOT_DIR/deploy/vps/compose/project1/.env"
P2_ENV_FILE="$ROOT_DIR/deploy/vps/compose/project2/.env"
P1_PY="$ROOT_DIR/.venv-p1/bin/python"
P2_PY="$ROOT_DIR/projects/project2-riscv/prototype_interp/.venv/bin/python"

echo "Starting all projects locally with non-conflicting ports."
echo ""
echo "Ports:"
echo "  Project 4 (portal):   http://localhost:3000   (API http://localhost:8000)"
echo "  Project 1 (MIPS):     http://localhost:3001"
echo "  Project 2 (RISC-V):   http://localhost:3002   (API http://localhost:25565)"
echo "  Project 3 (x86):      http://localhost:5173"
echo "  (P3 optional prod):   http://localhost:3003"
echo ""

echo "[P4] docker compose up -d --build"
(cd "$ROOT_DIR" && docker compose up -d --build)

echo "[P3] docker compose up web-x86-dev (in background)"
(cd "$ROOT_DIR/projects/project3-x86" && docker compose up -d --build web-x86-dev)

echo "[P1] python local_server.py (background, logs in .run-logs/p1.log)"
mkdir -p "$ROOT_DIR/.run-logs"
(
  cd "$ROOT_DIR/projects/project1-mips/deploy"
  if [[ -f "$P1_ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$P1_ENV_FILE"
    set +a
  fi
  export PORT=3001
  nohup "$P1_PY" local_server.py > "$ROOT_DIR/.run-logs/p1.log" 2>&1 &
)

echo "[P2] backend server.py (background, logs in .run-logs/p2-backend.log)"
(
  cd "$ROOT_DIR/projects/project2-riscv/prototype_interp"
  if [[ -f "$P2_ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$P2_ENV_FILE"
    set +a
  fi
  nohup "$P2_PY" server.py > "$ROOT_DIR/.run-logs/p2-backend.log" 2>&1 &
)

echo "[P2] frontend next dev on 3002 (background, logs in .run-logs/p2-frontend.log)"
(
  cd "$ROOT_DIR/projects/project2-riscv/riscv"
  if [[ -f "$P2_ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$P2_ENV_FILE"
    set +a
  fi
  nohup npm run dev -- -p 3002 > "$ROOT_DIR/.run-logs/p2-frontend.log" 2>&1 &
)

echo ""
echo "All start commands issued."
echo "If something fails to start, check:"
echo "  .run-logs/p1.log"
echo "  .run-logs/p2-backend.log"
echo "  .run-logs/p2-frontend.log"
echo "And docker logs for P3/P4."

