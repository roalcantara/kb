#!/usr/bin/env bash
# Tier 2, memory: RSS (rss.sh) and physical footprint (footprint.sh) in three scenarios — idle
# with the window hidden, search open, and after 100 scripted queries — for one app. Raycast is
# sampled twice per scenario: the whole app (all) and its extension host (worker).
# Usage: [KB_HOME=<home>] [SECONDS_PER=30] memory.sh kb|raycast <results-dir>
set -euo pipefail

app=$1
results=$2
seconds=${SECONDS_PER:-30}
probe=tmp/bin/probe
here=$(dirname "$0")
deeplink=raycast://extensions/roalcantara/kb/search.screen
[ -x "$probe" ] || {
  echo "need $probe; run mise run probes"
  exit 1
}

case $app in
kb)
  implementation=rust
  scopes=("all:kb\.app/Contents/MacOS/kb")
  app_path=target/packager/kb.app
  [ -d "$app_path" ] || {
    echo "need $app_path; run mise run package"
    exit 1
  }
  pkill -x kb || true
  while pgrep -x kb >/dev/null; do sleep 0.2; done
  open ${KB_HOME:+--env "HOME=$KB_HOME"} "$app_path"
  sleep 4
  show() { "$probe" key 40 opt; }
  hide() { "$probe" key 53; }
  ;;
raycast)
  implementation=ts
  scopes=("all:(Raycast\.app|Raycast Backend|com\.raycast)" "worker:Raycast Backend")
  show() { open "$deeplink"; }
  hide() { "$probe" key 53 && sleep 0.4 && "$probe" key 53; }
  ;;
*)
  echo "usage: memory.sh kb|raycast <results-dir>"
  exit 2
  ;;
esac

sample() {
  local scenario=$1 stamp scope pid pids=()
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  for scope in "${scopes[@]}"; do
    "$here/rss.sh" "${scope#*:}" "$scenario" "$seconds" \
      "$results/tier2-$implementation-rss-${scope%%:*}-$scenario-$stamp.json" &
    pids+=($!)
    "$here/footprint.sh" "${scope#*:}" "$scenario" "$seconds" \
      "$results/tier2-$implementation-footprint-${scope%%:*}-$scenario-$stamp.json" &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do wait "$pid"; done # one failed sampler fails the run
  echo "$scenario sampled"
}

hide
sleep 5
sample idle
show
sleep 2
sample open
"$here/drive-queries.sh" 100
sample after-100-queries
hide
