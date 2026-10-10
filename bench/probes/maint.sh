#!/usr/bin/env bash
# Maintainability: lines of code, dependencies, tests and build time of kb search in each
# implementation, written as maint-ts-<stamp>.json and maint-rust-<stamp>.json.
#
# Scope. TypeScript: search.screen.tsx, features/kb and packages/domain/kb in $KB_TS_REPO, read
# only. Rust: kb-domain and kb-app. Benchmarks and tooling are left out on both sides.
# Lines of code count everything, tests included; `tests` is the test files alone. Tests are
# counted statically (`it(`/`test(` calls; `#[test]` and `#[gpui_kit::test]`).
# The TypeScript build is not timed: `ray build` writes into Raycast's installed extension.
# Usage: maint.sh <results-dir> [--no-build]
set -euo pipefail

results=$1
build=${2:-}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
ts=${KB_TS_REPO:?set KB_TS_REPO}

code() { tokei -o json "$@" | jq '.Total.code'; }

# jscpd's duplicated-lines percentage over <format> files in <paths> (absolute), run from tmp so
# the repository's .jscpd.json (thresholds, its own paths) does not apply. Writes only under tmp.
dupes() {
  local format=$1 out
  shift
  out=$PWD/tmp/jscpd-${format%%,*}
  rm -rf "$out" && mkdir -p "$out"
  (cd "$out" && jscpd --silent --format "$format" --reporters json --output "$out" \
    --ignore '**/node_modules/**,**/target/**,**/dist/**' "$@" >/dev/null) || true
  jq '.statistics.total.percentage' "$out/jscpd-report.json"
}

# ── TypeScript ──
ts_paths=("$ts/apps/kb/src/search.screen.tsx" "$ts/apps/kb/src/features/kb" "$ts/packages/domain/kb/src")
mapfile -t ts_specs < <(find "${ts_paths[@]}" -name '*.spec.ts' -o -name '*.spec.tsx' | sort)
ts_direct=$(jq -s '[.[] | .dependencies // {} | keys[]] | unique | map(select(startswith("@kb/") | not)) | length' \
  "$ts/apps/kb/package.json" "$ts/packages/domain/kb/package.json")
# npm reads the installed tree and writes nothing. It cannot scope a Bun workspace to one
# package, so this is the depth of the whole Raycast repo's tree. npm exits non-zero over
# packages Bun hoists differently, yet still prints the tree; null if it prints nothing.
ts_depth=$( (npm ls --all --json --prefix "$ts" 2>/dev/null || true) |
  jq 'def d: if ((.dependencies // {}) | length) == 0 then 0 else 1 + ([.dependencies[] | d] | max) end; d')
ts_depth=${ts_depth:-null}
jq -n --arg date "$(date -u +%FT%TZ)" --arg commit "$(git -C "$ts" rev-parse --short HEAD)" \
  --argjson code "$(code "${ts_paths[@]}")" --argjson tests_loc "$(code "${ts_specs[@]}")" \
  --argjson direct "$ts_direct" --argjson depth "$ts_depth" \
  --argjson dupes "$(dupes typescript,tsx "${ts_paths[@]}")" \
  --argjson tests "$(cat "${ts_specs[@]}" | grep -cE '^\s*(it|test)(\.each\(.*\))?\(' || true)" \
  '{schema: 1, metric: "maintainability", implementation: "ts", date: $date, repoCommit: $commit,
    loc: {code: $code, tests: $tests_loc}, deps: {direct: $direct, total: null, depth: $depth}, tests: $tests,
    coverage: {lines: null}, duplication: {percent: $dupes}, lint: {clippyWarnings: null},
    build: {coldSeconds: null, incrementalSeconds: null},
    note: "dependencies: direct are the runtime dependencies of apps/kb (every command) and packages/domain/kb; transitive is not measured: esbuild inlines most of them into the bundle and Raycast supplies its API, so no count compares with cargo tree. Build not timed: ray build writes into the installed extension. Depth: the whole repo npm tree. Coverage not measured: the Raycast repo has no Vitest coverage provider, and nothing here writes to it. No clippy counterpart."}' \
  >"$results/maint-ts-$stamp.json"

# ── Rust ──
rs_paths=(crates/kb-domain crates/kb-app)
rs_direct=$(cargo tree -p kb-app -e normal --depth 1 --prefix none --locked | tail -n +2 | grep -v '^kb-domain' |
  cat - <(cargo tree -p kb-domain -e normal --depth 1 --prefix none --locked | tail -n +2) |
  sed 's/ (\*)//' | cut -d' ' -f1 | sort -u | wc -l | tr -d ' ')
rs_total=$(cargo tree -p kb-app -e normal --prefix none --locked | sed 's/ (\*)//' | sort -u | wc -l | tr -d ' ')
rs_depth=$(cargo tree -p kb-app -e normal --prefix depth --locked | sed -E 's/^([0-9]+).*/\1/' | sort -n | tail -1)
rs_coverage=$(cargo llvm-cov -p kb-domain -p kb-app --json --summary-only --locked 2>/dev/null |
  jq '.data[0].totals.lines.percent')
rs_clippy=$(cargo clippy -p kb-domain -p kb-app --all-targets --locked --message-format json 2>/dev/null |
  jq -s '[.[] | select(.reason == "compiler-message" and .message.level == "warning")] | length')
cold=null incremental=null
if [ "$build" != --no-build ]; then
  dir=tmp/build-time
  rm -rf "$dir"
  start=$(date +%s)
  CARGO_TARGET_DIR=$dir cargo build --release --locked -p kb-app --quiet
  cold=$(($(date +%s) - start))
  CARGO_TARGET_DIR=$dir cargo build --locked -p kb-app --quiet
  touch crates/kb-app/src/presentation.rs
  start=$(date +%s)
  CARGO_TARGET_DIR=$dir cargo build --locked -p kb-app --quiet
  incremental=$(($(date +%s) - start))
  rm -rf "$dir"
fi
jq -n --arg date "$(date -u +%FT%TZ)" --arg commit "$(git rev-parse --short HEAD)" \
  --argjson code "$(code "${rs_paths[@]}")" --argjson tests_loc "$(code crates/kb-domain/tests crates/kb-app/tests)" \
  --argjson direct "$rs_direct" --argjson total "$((rs_total - 1))" --argjson depth "$rs_depth" \
  --argjson coverage "$rs_coverage" --argjson clippy "$rs_clippy" \
  --argjson dupes "$(dupes rust "${rs_paths[@]/#/$PWD/}")" \
  --argjson tests "$(grep -rhE '#\[(test|gpui_kit::test)\]' "${rs_paths[@]}" | wc -l | tr -d ' ')" \
  --argjson cold "$cold" --argjson incremental "$incremental" \
  '{schema: 1, metric: "maintainability", implementation: "rust", date: $date, repoCommit: $commit,
    loc: {code: $code, tests: $tests_loc}, deps: {direct: $direct, total: $total, depth: $depth}, tests: $tests,
    coverage: {lines: $coverage}, duplication: {percent: $dupes}, lint: {clippyWarnings: $clippy},
    build: {coldSeconds: $cold, incrementalSeconds: $incremental},
    note: "the unit tests inline in src (#[cfg(test)]) count as code, not as test lines. Cold build: release with fat LTO, from an empty target directory; incremental: dev, after touching one file. Coverage: lines of kb-domain and kb-app under cargo llvm-cov (doctests excluded)."}' \
  >"$results/maint-rust-$stamp.json"
jq -c '{implementation, loc, deps, tests, coverage, duplication, lint, build}' "$results"/maint-*-"$stamp".json
