#!/usr/bin/env bash
# Types every non-empty query from fixtures/queries.json into the focused search field until
# <count> queries have been typed, clearing the field between them. The terminal running this
# needs Accessibility permission (System Settings > Privacy & Security > Accessibility).
# Usage: drive-queries.sh <count> [pause-seconds]
set -euo pipefail

count=$1
pause=${2:-0.4}
# macOS ships bash 3.2, which has no mapfile.
texts=()
while IFS= read -r line; do texts+=("$line"); done < <(jq -r '.[] | select(.text != "") | .text' fixtures/queries.json)

for ((i = 0; i < count; i++)); do
  text=${texts[i % ${#texts[@]}]}
  osascript \
    -e 'tell application "System Events"' \
    -e 'keystroke "a" using command down' \
    -e 'key code 51' \
    -e "keystroke \"$text\"" \
    -e 'end tell'
  sleep "$pause"
done
