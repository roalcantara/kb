#!/usr/bin/env bash
# Tier 3, Raycast keystroke → updated list, timed by hand (methodology, "Tier 3"): record the
# screen at <fps> while typing the last letter of a query, and for each run count the frames from
# the key's echo in the search field to the list's change. Turns the counts into a result in the
# shared schema: samples in ms, nearest-rank stats.
# Usage: manual-keystroke.sh <results-dir> <fps> <frames>...
set -euo pipefail

[ $# -ge 3 ] || {
  echo "usage: manual-keystroke.sh <results-dir> <fps> <frames>..."
  exit 2
}
results=$1
fps=$2
shift 2
stamp=$(date -u +%Y%m%dT%H%M%SZ)

printf '%s\n' "$@" | jq -s --argjson fps "$fps" --arg date "$(date -u +%FT%TZ)" \
  '. as $frames | map(. * 1000 / $fps) as $samples | ($samples | sort) as $s | ($s | length) as $n |
   {schema: 1, tier: 3, metric: "keystroke-manual", unit: "ms", implementation: "ts", app: "raycast",
    method: "manual-\($fps)fps", date: $date, frames: $frames, samples: $samples,
    stats: {n: $n, min: $s[0], p25: $s[(($n * 0.25) | ceil) - 1], p50: $s[(($n * 0.5) | ceil) - 1],
            p75: $s[(($n * 0.75) | ceil) - 1], max: $s[$n - 1]}}' \
  >"$results/tier3-raycast-keystroke-manual-$stamp.json"
jq -r '"keystroke-manual: p50 \(.stats.p50) ms (IQR \(.stats.p25)–\(.stats.p75), n \(.stats.n))"' \
  "$results/tier3-raycast-keystroke-manual-$stamp.json"
