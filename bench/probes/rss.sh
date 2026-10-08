#!/usr/bin/env bash
# Samples resident memory of the processes whose command line matches a pattern, once a second,
# and writes one JSON result. Usage: rss.sh <pattern> <scenario> <seconds> <out.json>
set -euo pipefail

pattern=$1
scenario=$2
seconds=$3
out=$4

samples=()
for ((i = 0; i < seconds; i++)); do
  # ps reports RSS in KiB; the sum covers every matching process (an app and its helpers).
  # shellcheck disable=SC2009
  kib=$(ps -axo rss=,command= | grep -E -- "$pattern" | grep -v -E 'grep|rss\.sh' | awk '{s += $1} END {print s + 0}')
  samples+=("$((kib * 1024))")
  sleep 1
done

printf '%s\n' "${samples[@]}" | jq -s \
  --arg pattern "$pattern" --arg scenario "$scenario" --arg date "$(date -u +%FT%TZ)" \
  '{schema: 1, tier: 2, metric: "rss", unit: "bytes", pattern: $pattern, scenario: $scenario, date: $date,
    samples: ., stats: {min: min, max: max, p50: (sort | .[(length / 2 | floor)])}}' >"$out"
echo "$scenario: p50 $(jq '.stats.p50 / 1048576 | floor' "$out") MiB -> $out"
