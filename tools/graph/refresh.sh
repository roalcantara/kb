#!/usr/bin/env bash
# Run by hk after each commit, merge and checkout (hk.pkl): updates the code graphs in the background and returns at
# once. Never in CI. Log: tmp/graph-update.log.
#
# One worker runs at a time, holding the lock directory with its pid inside. Every hook marks an update pending first,
# so a change made while the worker runs is picked up before it exits; after releasing the lock the worker looks once
# more and takes the lock back if a hook marked one in between. A lock whose worker died (sleep, reboot) is replaced.
set -euo pipefail

[ -z "${CI:-}" ] || exit 0
mkdir -p tmp
lock=tmp/graph-update.lock
pending=tmp/graph-update.pending

if [ "${1:-}" = --worker ]; then
  echo "$$" >"$lock/pid"
  while :; do
    while [ -f "$pending" ]; do
      rm -f "$pending"
      mise run graph update >tmp/graph-update.log 2>&1 || true
    done
    rm -rf "$lock"
    [ -f "$pending" ] || exit 0         # nothing arrived while releasing
    mkdir "$lock" 2>/dev/null || exit 0 # a newer hook started its own worker
    echo "$$" >"$lock/pid"
  done
fi

touch "$pending"
if ! mkdir "$lock" 2>/dev/null; then
  pid=$(cat "$lock/pid" 2>/dev/null || true)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then exit 0; fi # running: it will see the pending marker
  # No pid yet: a worker is starting, unless the lock is older than a minute (its hook died before starting one).
  if [ -z "$pid" ] && [ -z "$(find "$lock" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then exit 0; fi
  rm -rf "$lock" # stale: its worker died without releasing it
  mkdir "$lock" 2>/dev/null || exit 0
fi
nohup "$0" --worker </dev/null >/dev/null 2>&1 &
