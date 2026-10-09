#!/usr/bin/env bash
# Types every non-empty query from fixtures/queries.json into the focused search field until
# <count> queries have been typed, clearing the field between them. Keys are posted with the
# CGEvent probe (tmp/bin/probe, built by `mise run probes`): AppleScript keystrokes would take
# focus from a launcher panel and hide it. The terminal needs Accessibility permission.
# Usage: drive-queries.sh <count> [pause-seconds]
set -euo pipefail

count=$1
pause=${2:-0.4}
probe=tmp/bin/probe
[ -x "$probe" ] || {
  echo "no $probe; run mise run probes"
  exit 1
}
# macOS ships bash 3.2, which has no mapfile.
texts=()
while IFS= read -r line; do texts+=("$line"); done < <(jq -r '.[] | select(.text != "") | .text' fixtures/queries.json)

for ((i = 0; i < count; i++)); do
  "$probe" key 0 cmd # ⌘A: select the field's text
  "$probe" key 51    # delete it
  "$probe" type "${texts[i % ${#texts[@]}]}"
  sleep "$pause"
done
