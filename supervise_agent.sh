#!/bin/bash
# Supervisor: keeps Leo's agent alive. If the node process is reaped/exits,
# it restarts after 10s. The agent itself is patient (retries pay() on Arc
# -32011 with 45s backoff), so a persistent process WILL land a payment the
# moment Arc's public-RPC tx throttle lifts for our IP.
export PATH="$HOME/.foundry/bin:$PATH"
cd /c/Users/Administrator/arc-autopay
while true; do
  node agent_live.mjs >> agent_run.log 2>&1
  echo "[$(date -u +%FT%TZ)] agent exited rc=$?; restarting in 10s" >> agent_restart.log
  sleep 10
done
