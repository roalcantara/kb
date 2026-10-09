#!/usr/bin/env bash
# Tier 3, the action step of task T2 (find a command and copy it): <runs> rounds of open the kb
# search, type a query whose first result is a command, wait past the debounce, then time ⌘↩ →
# the clipboard changing with `probe copy`. kb opens by its hotkey; Raycast's kb command by its
# deeplink, since how it opens does not change what ⌘↩ costs.
# Usage: [KB_HOME=<home>] [QUERY=kubectl] action.sh kb|raycast <results-dir> [runs]
set -euo pipefail

app=$1
results=$2
runs=${3:-30}
query=${QUERY:-kubectl}
probe=tmp/bin/probe
stamp=$(date -u +%Y%m%dT%H%M%SZ)
deeplink=raycast://extensions/roalcantara/kb/search.screen
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
  pkill -x kb || true
  while pgrep -x kb >/dev/null; do sleep 0.2; done
  HOME=${KB_HOME:-$HOME} "$binary" 2>/dev/null &
  sleep 4
  "$probe" key 53
  sleep 1
  show() { "$probe" key 40 opt; }
  ;;
raycast) show() { open "$deeplink"; } ;;
*)
  echo "usage: action.sh kb|raycast <results-dir> [runs]"
  exit 2
  ;;
esac

samples=()
for ((run = 1; run <= runs; run++)); do
  show
  sleep 1.5
  "$probe" type "$query"
  sleep 0.8
  samples+=("$("$probe" copy 36 cmd)") # ⌘↩
  sleep 0.5
  for _ in 1 2; do # Esc until the window is gone: Raycast pops to root first
    [ -n "$("$probe" windows "$([ "$app" = kb ] && echo kb || echo Raycast)" | grep 'onscreen=true' || true)" ] || break
    "$probe" key 53
    sleep 0.4
  done
  sleep 0.5
done
[ "$app" = kb ] && pkill -x kb || true

printf '%s\n' "${samples[@]}" | jq -s --arg app "$app" --arg query "$query" --arg date "$(date -u +%FT%TZ)" \
  'sort as $s | ($s | length) as $n |
   {schema: 1, tier: 3, metric: "action-copy", unit: "ms", implementation: (if $app == "kb" then "rust" else "ts" end),
    app: $app, query: $query, date: $date, samples: .,
    stats: {n: $n, min: $s[0], p25: $s[(($n * 0.25) | ceil) - 1], p50: $s[(($n * 0.5) | ceil) - 1],
            p75: $s[(($n * 0.75) | ceil) - 1], max: $s[$n - 1]}}' >"$results/tier3-$app-action-$stamp.json"
jq -r '"action-copy: p50 \(.stats.p50) ms (IQR \(.stats.p25)–\(.stats.p75), n \(.stats.n))"' "$results/tier3-$app-action-$stamp.json"
