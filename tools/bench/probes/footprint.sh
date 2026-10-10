#!/usr/bin/env bash
# Samples the physical footprint — the memory macOS attributes to a process, as Activity Monitor
# shows it, GPU surfaces included — of every process whose command line matches a pattern, once
# a second, and writes one JSON result. RSS (rss.sh) counts shared pages and misses GPU memory,
# so the two are reported side by side.
# Usage: footprint.sh <pattern> <scenario> <seconds> <out.json>
set -euo pipefail

pattern=$1
scenario=$2
seconds=$3
out=$4

samples=()
for ((i = 0; i < seconds; i++)); do
  total=0
  for pid in $(pgrep -f -- "$pattern"); do
    # Not the probes, whose command lines carry the pattern.
    ps -o command= -p "$pid" | grep -q 'bench/probes/' && continue
    # "kb [123]: 64-bit    Footprint: 116 MB (16384 bytes per page)"; footprint reports KB, MB or GB.
    bytes=$(footprint -p "$pid" 2>/dev/null | awk '/Footprint:/ {
      for (i = 1; i <= NF; i++) if ($i == "Footprint:") { v = $(i + 1); u = $(i + 2) }
      m = (u == "KB") ? 1024 : (u == "MB") ? 1048576 : (u == "GB") ? 1073741824 : 1
      printf "%d", v * m; exit }') || bytes=0 # a process that exits, or refuses, between pgrep and here
    total=$((total + ${bytes:-0}))
  done
  samples+=("$total")
  sleep 1
done

printf '%s\n' "${samples[@]}" | jq -s \
  --arg pattern "$pattern" --arg scenario "$scenario" --arg date "$(date -u +%FT%TZ)" \
  '{schema: 1, tier: 2, metric: "footprint", unit: "bytes", pattern: $pattern, scenario: $scenario, date: $date,
    samples: ., stats: {min: min, max: max, p50: (sort | .[((length + 1) / 2 | floor) - 1])}}' >"$out"
echo "$scenario: p50 $(jq '.stats.p50 / 1048576 | floor' "$out") MiB -> $out"
