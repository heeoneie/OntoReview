#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# OntoReview Dev Server — Start / Stop / Restart
#
# Usage:
#   ./scripts/dev.sh          # kill old → start both
#   ./scripts/dev.sh start    # same as above
#   ./scripts/dev.sh stop     # kill both servers
#   ./scripts/dev.sh restart  # stop → start
#
# Override ports:
#   BACKEND_PORT=8001 ./scripts/dev.sh
# ─────────────────────────────────────────────────────────

set -e

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

log()  { echo -e "\033[0;32m[dev]\033[0m $1"; }
warn() { echo -e "\033[1;33m[dev]\033[0m $1"; }

# ── Kill processes on a given port ──
kill_port() {
  local port=$1
  local pids
  pids=$(netstat -ano 2>/dev/null \
    | grep ":${port} " \
    | grep "LISTEN" \
    | awk '{print $NF}' \
    | sort -u \
    | grep -E '^[0-9]+$' || true)

  [ -z "$pids" ] && return 0

  for pid in $pids; do
    [ "$pid" = "0" ] && continue
    warn "Killing PID $pid on port $port"
    taskkill //PID "$pid" //T //F 2>/dev/null || true
  done
  sleep 1
}

# ── Start servers ──
do_start() {
  cd "$PROJECT_ROOT"

  # Activate venv
  if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
  elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
  else
    warn "No venv found — using system Python"
  fi

  log "Starting backend on port $BACKEND_PORT..."
  uvicorn backend.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT" &
  BACKEND_PID=$!

  log "Starting frontend on port $FRONTEND_PORT..."
  cd "$PROJECT_ROOT/frontend"
  npm run dev -- --port "$FRONTEND_PORT" &
  FRONTEND_PID=$!

  cd "$PROJECT_ROOT"

  echo ""
  log "========================================="
  log "  Backend:  http://localhost:$BACKEND_PORT"
  log "  Frontend: http://localhost:$FRONTEND_PORT"
  log "========================================="
  log "Press Ctrl+C to stop both servers"
  echo ""

  # Trap Ctrl+C — use taskkill for clean shutdown
  trap 'echo ""; warn "Shutting down..."; kill_port $BACKEND_PORT; kill_port $FRONTEND_PORT; log "Done."; exit 0' INT TERM

  wait
}

# ── Stop servers ──
do_stop() {
  log "Stopping servers..."
  kill_port "$BACKEND_PORT"
  kill_port "$FRONTEND_PORT"
  log "Stopped."
}

# ── Main ──
case "${1:-start}" in
  start)   do_stop 2>/dev/null || true; do_start ;;
  stop)    do_stop ;;
  restart) do_stop; do_start ;;
  *)       echo "Usage: $0 {start|stop|restart}"; exit 1 ;;
esac
