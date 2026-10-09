#!/usr/bin/env bash
# Measures the release `kb` binary and fails when it outgrows the budget in tools/size-budget.
# Usage: size-rs.sh [out.json]   (build first: cargo build --release --locked -p kb-app)
set -euo pipefail

binary=target/release/kb
budget=$(tr -d '[:space:]' <tools/size-budget)
[ -f "$binary" ] || {
  echo "no $binary; run cargo build --release --locked -p kb-app"
  exit 1
}
bytes=$(stat -f %z "$binary")

if [ -n "${1:-}" ]; then
  jq -n --arg date "$(date -u +%FT%TZ)" --arg commit "$(git describe --always --dirty --abbrev=40)" \
    --argjson bytes "$bytes" --argjson budget "$budget" \
    '{schema: 1, tier: 2, metric: "artifact-size", unit: "bytes", implementation: "rust", date: $date,
      repoCommit: $commit, bundle: "release binary, stripped, LTO", bytes: $bytes, budget: $budget}' >"$1"
fi

echo "kb: $((bytes / 1048576)) MiB ($bytes bytes), budget $((budget / 1048576)) MiB"
if [ "$bytes" -gt "$budget" ]; then
  echo "    -> the binary outgrew its budget; find the cause with cargo bloat before raising tools/size-budget"
  exit 1
fi
