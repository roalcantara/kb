#!/usr/bin/env bash
# Prints the home the kb probes run kb under: $KB_HOME, else tmp/bench-home (mise run
# bench:home), so kb reads fixtures/private like the runs it is compared with. Fails when that
# home holds no index.
# Usage: kb_home=$(bench/probes/kb-home.sh)
set -euo pipefail

home=${KB_HOME:-$PWD/tmp/bench-home}
[ -f "$home/Library/Application Support/kb-native/kb.db" ] || {
  echo "no kb index under $home; run mise run bench:home" >&2
  exit 1
}
echo "$home"
