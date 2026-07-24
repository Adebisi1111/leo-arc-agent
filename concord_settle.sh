#!/bin/bash
# Concord — Autonomous Settlement Agent launcher
# Runs `node settle.js` and only emits output if a real payment was made
# (Telegram-ready notification with tx hashes) or if it errored.
# If stdout is empty, the agent was idle (nothing due) — prints nothing.
set -uo pipefail

cd /c/Users/Administrator/arc-autopay

# Run the settlement agent, separating stdout (status) and stderr (errors).
OUT=$(node settle.js 2>/tmp/concord_settle.err)
RC=$?
ERR=$(cat /tmp/concord_settle.err 2>/dev/null)

# If the process errored, surface the error.
if [ "$RC" -ne 0 ]; then
  echo "Concord settlement error (exit $RC):"
  echo "$ERR" | head -8
  exit 1
fi

# Extract payment notification lines (NOTIFY|...) produced by settle.js.
NOTIFIES=$(printf '%s\n' "$OUT" | grep '^NOTIFY|' || true)

if [ -z "$NOTIFIES" ]; then
  # Nothing was paid — agent idle. Print nothing.
  exit 0
fi

# Build a Telegram-ready summary from the NOTIFY lines.
COUNT=$(printf '%s\n' "$NOTIFIES" | wc -l | tr -d ' ')
HASHES=$(printf '%s\n' "$NOTIFIES" | awk -F'|' '{print $NF}' | sed 's/^/  • /')
echo "💸 Concord just settled $COUNT payment(s):"
printf '%s\n' "$HASHES"
