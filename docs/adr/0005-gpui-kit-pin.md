# 0005. Pin GPUI Kit 0.7.1 and what it brings

- Status: accepted
- Date: 2026-10-09

## Context

`kb-app` depends on GPUI Kit alone (ADR 0001), and through it on GPUI's text, platform and HTTP stacks. Three
things follow from that tree and need a decision rather than a workaround.

## Decision

- `gpui-kit` is pinned to `=0.7.1`. An upgrade is its own change, re-running every gate.
- Its tree-sitter grammars are enabled for the fence languages the corpus uses: bash (also `sh`, `zsh`),
  javascript, typescript, python, ruby, yaml, sql, toml, markdown, kotlin. JSON and plain text are built in. Any
  other fence renders unhighlighted.
- `cc` is held at `1.2.67` in `Cargo.lock`: `gpui-component` needs `tree-sitter-sequel`, which asks for `cc ~1.2`,
  while the newest `cc` that satisfies the rest of the tree is 1.6. `cargo update -p cc --precise 1.2.67` restores it.
- `deny.toml` allows two more permissive licenses in the tree (0BSD, bzip2-1.0.6) and ignores five
  unmaintained-crate advisories GPUI Kit pulls in (`instant`, `paste`, `rustls-pemfile`, `ttf-parser`,
  `rustybuzz`), each with its reason. They are reviewed again on every upgrade.
- The release binary has a size budget, `tools/size-budget`: the first release build (29,184,624 bytes) plus 5 %.
  The `size-budget` hk step fails above it; raising it is an owner decision.

## Consequences

The app is reproducible from the lockfile. Its supply-chain exceptions are visible in one place, with reasons,
instead of being silenced.
