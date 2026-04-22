#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Stopping all projects locally..."

echo "[P4] docker compose down"
(cd "$ROOT_DIR" && docker compose down || true)

echo "[P3] docker compose down"
(cd "$ROOT_DIR/projects/project3-x86" && docker compose down || true)

echo "[P1] kill local server"
pkill -f "projects/project1-mips/deploy/local_server.py" 2>/dev/null || true
pkill -f "project1-mips/deploy/local_server.py" 2>/dev/null || true
pkill -f "api.index" 2>/dev/null || true

echo "[P2] kill backend + frontend"
pkill -f "projects/project2-riscv/prototype_interp/server.py" 2>/dev/null || true
pkill -f "project2-riscv/prototype_interp/server.py" 2>/dev/null || true
pkill -f "next dev -p 3002" 2>/dev/null || true

echo ""
echo "Done."

