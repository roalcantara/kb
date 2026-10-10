#!/usr/bin/env bash
# Run by hk after each commit, merge and checkout (hk.pkl): starts `mise run graph update` in the background, one
# run at a time, logging to tmp/graph-update.log, and returns at once. Never in CI.
set -euo pipefail

[ -z "${CI:-}" ] || exit 0
mkdir -p tmp
lock=tmp/graph-update.lock
mkdir "$lock" 2>/dev/null || exit 0 # an update is already running
(
  trap 'rmdir "$lock"' EXIT
  mise run graph update >tmp/graph-update.log 2>&1
) </dev/null >/dev/null 2>&1 &
