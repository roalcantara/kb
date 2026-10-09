#!/usr/bin/env bash
# Tier 3, perceived latency: <runs> rounds of show the app by its hotkey, type a query, clear it,
# hide it. `probe show` times hotkey → window on screen from outside, for either app. For kb,
# `kb --trace` also reports show and keystroke → updated list from inside, as both ends of its
# drawn..presented range (src/trace.rs). Raycast exposes no equivalent, so its keystroke latency
# is the manual screen-recording step in docs/experiment/methodology.md.
# Usage: [KB_HOME=<home>] [HOTKEY="49 cmd"] latency.sh kb|raycast <results-dir> [runs]
#   HOTKEY: Raycast's hotkey as "<keycode> <mods>"; default ⌘Space, its root search.
set -euo pipefail

app=$1
results=$2
runs=${3:-30}
probe=tmp/bin/probe
stamp=$(date -u +%Y%m%dT%H%M%SZ)
[ -x "$probe" ] || {
  echo "need $probe; run mise run probes"
  exit 1
}

case $app in
kb)
  binary=target/packager/kb.app/Contents/MacOS/kb
  [ -x "$binary" ] || {
    echo "need $binary; run mise run package"
    exit 1
  }
  owner=kb
  read -r code mods <<<"40 opt"
  trace=$(mktemp)
  pkill -x kb || true
  while pgrep -x kb >/dev/null; do sleep 0.2; done
  HOME=${KB_HOME:-$HOME} "$binary" --trace 2>>"$trace" &
  sleep 4
  "$probe" key 53 # it opens shown; hide it so every round starts hidden
  sleep 1
  ;;
raycast)
  owner=Raycast
  read -r code mods <<<"${HOTKEY:-49 cmd}"
  ;;
*)
  echo "usage: latency.sh kb|raycast <results-dir> [runs]"
  exit 2
  ;;
esac

shows=()
for ((run = 1; run <= runs; run++)); do
  shows+=("$("$probe" show "$owner" "$code" "$mods")")
  sleep 0.5
  "$probe" type docker
  sleep 0.6
  "$probe" key 0 cmd # ⌘A, then ⌫: clear the query
  "$probe" key 51
  sleep 0.6
  "$probe" key 53 # Esc: hide
  sleep 0.8
done

# Nearest-rank percentiles, as everywhere else in the results. A jq program, not shell.
# shellcheck disable=SC2016
stats='sort as $s | ($s | length) as $n | {n: $n, min: $s[0], p25: $s[(($n * 0.25) | ceil) - 1],
  p50: $s[(($n * 0.5) | ceil) - 1], p75: $s[(($n * 0.75) | ceil) - 1], max: $s[$n - 1]}'
# A trace line's range is drawn..presented (src/trace.rs): `bound <metric> 1|2` reads one end.
bound() { sed -n "s/^kb trace: $1 \([0-9.]*\)\.\.\([0-9.]*\) ms.*/\\$2/p" "$trace"; }
settle() { sed -n "s/^kb trace: keystroke .*(settle \([0-9.]*\)\.\.\([0-9.]*\) ms)/\\$1/p" "$trace"; }

metrics=$(printf '%s\n' "${shows[@]}" | jq -s "{\"show-external\": {samples: ., stats: ($stats)}}")
if [ "$app" = kb ]; then
  pkill -x kb || true
  add() { metrics=$(jq -s --argjson m "$metrics" --arg k "$1" "\$m + {(\$k): {samples: ., stats: ($stats)}}"); }
  for metric in show keystroke; do
    add "$metric-trace-drawn" < <(bound "$metric" 1)
    add "$metric-trace-presented" < <(bound "$metric" 2)
  done
  add settle-trace-drawn < <(settle 1)
  add settle-trace-presented < <(settle 2)
  rm -f "$trace"
fi

jq -n --argjson metrics "$metrics" --arg app "$app" --arg date "$(date -u +%FT%TZ)" --arg hotkey "$code $mods" \
  '{schema: 1, tier: 3, unit: "ms", implementation: (if $app == "kb" then "rust" else "ts" end), app: $app,
    hotkey: $hotkey, date: $date, metrics: $metrics}' >"$results/tier3-$app-$stamp.json"
jq -r '.metrics | to_entries[] | "\(.key): p50 \(.value.stats.p50) ms (IQR \(.value.stats.p25)–\(.value.stats.p75), n \(.value.stats.n))"' \
  "$results/tier3-$app-$stamp.json"
