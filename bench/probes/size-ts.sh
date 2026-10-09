#!/usr/bin/env bash
# Measures the kb bundle Raycast actually loads: the extension directory `ray develop` (or an
# installed store build) writes under ~/.config/raycast/extensions. `ray build` cannot be used:
# its type-definition step needs the TypeScript JS API, which TypeScript 7 does not ship.
# Usage: size-ts.sh <out.json> [extension-dir]
set -euo pipefail

out=$1
dir=${2:-$HOME/.config/raycast/extensions/kb}
[ -f "$dir/search.screen.js" ] || {
  echo "no kb bundle at $dir; run 'ray develop' in the Raycast repo once"
  exit 1
}

bytes() { find "$@" -type f -exec stat -f %z {} + 2>/dev/null | awk '{s += $1} END {print s + 0}'; }

jq -n --arg date "$(date -u +%FT%TZ)" --arg dir "$dir" \
  --arg built "$(stat -f %Sm -t %FT%T "$dir/search.screen.js")" \
  --argjson total "$(bytes "$dir")" \
  --argjson files "$(find "$dir" -type f | wc -l | tr -d ' ')" \
  --argjson js "$(bytes "$dir" -name '*.js')" \
  --argjson maps "$(bytes "$dir" -name '*.map')" \
  --argjson search "$(bytes "$dir/search.screen.js")" \
  --argjson modules "$(bytes "$dir/node_modules")" \
  --argjson assets "$(bytes "$dir/assets")" \
  '{schema: 1, tier: 2, metric: "artifact-size", unit: "bytes", implementation: "ts", date: $date,
    source: $dir, built: $built, bundle: "ray develop", files: $files,
    bytes: $total, jsBytes: $js, mapBytes: $maps, searchCommandJsBytes: $search,
    nodeModulesBytes: $modules, assetsBytes: $assets,
    note: "The bundle holds all five commands (kb, jobx, yabai); searchCommandJsBytes is kb search alone."}' >"$out"
jq -c '{bytes, jsBytes, mapBytes, searchCommandJsBytes, nodeModulesBytes, assetsBytes}' "$out"
