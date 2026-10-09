#!/usr/bin/env bash
# Builds crates/kb-app/assets/icon.icns from the 1024 px PNG with Apple's iconutil.
# Usage: tools/icon/icns.sh   (after: swift tools/icon/icon.swift crates/kb-app/assets/icon.png)
set -euo pipefail

png=crates/kb-app/assets/icon.png
set_dir=$(mktemp -d)/icon.iconset
mkdir -p "$set_dir"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$png" --out "$set_dir/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$png" --out "$set_dir/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$set_dir" -o crates/kb-app/assets/icon.icns
echo "crates/kb-app/assets/icon.icns"
