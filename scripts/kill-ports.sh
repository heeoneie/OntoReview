#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Quick port killer for Windows (Git Bash)
#
# Usage:
#   ./scripts/kill-ports.sh              # kill 8000 + 5173
#   ./scripts/kill-ports.sh 8000 3000    # kill specific ports
# ─────────────────────────────────────────────────────────

PORTS="${@:-8000 8001 5173}"

for port in $PORTS; do
  echo "[kill] Checking port $port..."

  # Get PIDs via netstat (fastest, no PowerShell hang risk)
  pids=$(netstat -ano 2>/dev/null \
    | grep ":${port} " \
    | grep "LISTEN" \
    | awk '{print $NF}' \
    | sort -u \
    | grep -E '^[0-9]+$' || true)

  if [ -z "$pids" ]; then
    echo "[kill] Port $port is free"
    continue
  fi

  for pid in $pids; do
    [ "$pid" = "0" ] && continue
    echo "[kill] Killing PID $pid (tree) on port $port"
    # /T = tree kill (parent + children), /F = force
    taskkill //PID "$pid" //T //F 2>/dev/null || true
  done

  sleep 1

  if netstat -ano 2>/dev/null | grep ":${port} " | grep -q "LISTEN"; then
    echo "[kill] WARNING: Port $port still occupied (OS-level zombie — reboot may be needed)"
  else
    echo "[kill] Port $port freed"
  fi
done
