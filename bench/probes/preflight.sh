#!/usr/bin/env bash
# Checks what a measurement session needs that can be checked from here, prints every miss, and
# fails if there was one. Accessibility permission for the terminal and the kb extension running
# in Raycast are the owner's (docs/experiment/methodology.md, "Session").
# Usage: preflight.sh
set -euo pipefail

missing=()
[ -x tmp/bin/probe ] || missing+=("tmp/bin/probe: run mise run probes")
[ -n "${KB_RAYCAST_HOTKEY:-}" ] ||
  missing+=("KB_RAYCAST_HOTKEY: assign kb Search a hotkey in Raycast and set it in mise.local.toml")
pgrep -x Raycast >/dev/null || missing+=("Raycast is not running")
[ -f "$HOME/.config/raycast/extensions/kb/search.screen.js" ] ||
  missing+=("no kb extension bundle under ~/.config/raycast/extensions/kb: start it in Raycast (owner)")
pmset -g batt | grep -q "AC Power" || missing+=("on battery: plug in AC power")

if [ ${#missing[@]} -eq 0 ]; then
  echo "preflight ok"
  exit 0
fi
printf 'missing: %s\n' "${missing[@]}"
exit 1
