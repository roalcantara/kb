#!/usr/bin/env bash
# Cold-start CPU of the kb app: each run quits it, launches the bundle, shows the panel with
# ⌥K, waits for it to settle, then reads the CPU time (`ps` TIME) the process has used since
# launch. Writes one result with every run's sample. The same method as cpu-ts.sh.
# Usage: [KB_HOME=<home>, default tmp/bench-home] cpu-rs.sh <results-dir> [runs] [settle-seconds]
set -euo pipefail

results=$1
runs=${2:-5}
settle=${3:-10}
app=target/packager/kb.app
probe=tmp/bin/probe
stamp=$(date -u +%Y%m%dT%H%M%SZ)
[ -d "$app" ] && [ -x "$probe" ] || {
  echo "need $app and $probe; run mise run package and mise run probes"
  exit 1
}
kb_home=$("$(dirname "$0")/kb-home.sh")

samples=()
for ((run = 1; run <= runs; run++)); do
  pkill -x kb || true
  while pgrep -x kb >/dev/null; do sleep 0.2; done
  sleep 2
  open --env "HOME=$kb_home" "$app"
  sleep 3
  "$probe" key 40 opt # ⌥K: show the panel, as a person would
  sleep "$settle"
  seconds=$(ps -o time= -p "$(pgrep -x kb)" | jq -R 'gsub(" "; "") | split(":") | (.[0] | tonumber) * 60 + (.[1] | tonumber)')
  samples+=("$seconds")
  "$probe" key 53 # Esc: hide it again
  echo "run $run: $seconds s"
done

printf '%s\n' "${samples[@]}" | jq -s --arg date "$(date -u +%FT%TZ)" --argjson settle "$settle" \
  '{schema: 1, tier: 2, metric: "cold-start-cpu", unit: "seconds", implementation: "rust", scope: "all",
    settleSeconds: $settle, date: $date, samples: ., stats: {min: min, max: max, p50: (sort | .[((length + 1) / 2 | floor) - 1])}}' \
  >"$results/tier2-rust-cpu-all-$stamp.json"
