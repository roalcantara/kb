#!/usr/bin/env bash
# Cold-start CPU of Raycast showing kb search. Each run quits Raycast, relaunches it, opens kb's
# Search command by deeplink, waits for it to settle, then sums the CPU time (`ps` TIME) every
# matching process has used since launch. Writes one result per scope with every run's sample.
# Usage: cpu-ts.sh <results-dir> [runs] [settle-seconds]
set -euo pipefail

results=$1
runs=${2:-5}
settle=${3:-10}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
all='(Raycast\.app|Raycast Backend|com\.raycast)'
worker='Raycast Backend'
deeplink='raycast://extensions/roalcantara/kb/search.screen'

# Prints the summed CPU seconds of the processes matching a pattern.
cpu_seconds() {
  # TIME is minutes:seconds.hundredths. pgrep cannot print TIME, so ps is grepped.
  # shellcheck disable=SC2009
  ps -axo time=,command= | grep -E -- "$1" | grep -v -E 'grep|cpu-ts\.sh' | awk '{print $1}' |
    jq -R 'split(":") | (.[0] | tonumber) * 60 + (.[1] | tonumber)' | jq -s 'add // 0'
}

all_samples=()
worker_samples=()
for ((run = 1; run <= runs; run++)); do
  # Raycast refuses AppleScript's quit (error -128); SIGTERM asks it to terminate normally.
  killall Raycast 2>/dev/null || true
  while pgrep -f 'Raycast\.app/Contents/MacOS/Raycast' >/dev/null; do sleep 0.5; done
  sleep 3
  open -a Raycast
  sleep 5
  open "$deeplink"
  # The list loads its first page within a second; the rest lets the processes go idle, so the
  # reading is the whole cold start and nothing of a later interaction.
  sleep "$settle"
  all_samples+=("$(cpu_seconds "$all")")
  worker_samples+=("$(cpu_seconds "$worker")")
  osascript -e 'tell application "System Events" to key code 53'
  echo "run $run: all ${all_samples[run - 1]} s, worker ${worker_samples[run - 1]} s"
done

write() {
  local scope=$1 pattern=$2
  shift 2
  printf '%s\n' "$@" | jq -s \
    --arg scope "$scope" --arg pattern "$pattern" --arg date "$(date -u +%FT%TZ)" --argjson settle "$settle" \
    '{schema: 1, tier: 2, metric: "cold-start-cpu", unit: "seconds", implementation: "ts", scope: $scope,
      pattern: $pattern, settleSeconds: $settle, date: $date, samples: .,
      stats: {min: min, max: max, p50: (sort | .[((length + 1) / 2 | floor) - 1])}}' \
    >"$results/tier2-ts-cpu-$scope-$stamp.json"
}
write all "$all" "${all_samples[@]}"
write worker "$worker" "${worker_samples[@]}"
