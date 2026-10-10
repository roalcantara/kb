#!/usr/bin/env bash
# Run by hk after each commit, merge and checkout (hk.pkl): updates the code graphs in the background and returns at
# once. Never in CI. One update runs at a time; a change made while one runs marks it pending, and the running job
# updates again before it exits, so the last change is always indexed. A lock left by a killed job (sleep, reboot) is
# detected by its pid and replaced. Log: tmp/graph-update.log.
set -euo pipefail

[ -z "${CI:-}" ] || exit 0
mkdir -p tmp
lock=tmp/graph-update.lock # a directory holding the running job's pid
pending=tmp/graph-update.pending
touch "$pending"

if ! mkdir "$lock" 2>/dev/null; then
  pid=$(cat "$lock/pid" 2>/dev/null || true)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then exit 0; fi # running: it will see the pending marker
  rm -rf "$lock"                                                  # stale: its job died without cleaning up
  mkdir "$lock" 2>/dev/null || exit 0
fi

(
  while [ -f "$pending" ]; do
    rm -f "$pending"
    mise run graph update >tmp/graph-update.log 2>&1 || true
  done
  rm -rf "$lock"
) </dev/null >/dev/null 2>&1 &
echo $! >"$lock/pid"
