# AGENTS.md

## Project overview

An experiment: a native Rust port of the kb Raycast extension's search command, on GPUI Kit, measured against the
original. The design is [docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md][spec]; plans live
in `docs/superpowers/plans/`.

[spec]: docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md

## Repository map

- `crates/kb-domain/`: the engine; no UI dependency
- `crates/kb-app/`: the GPUI Kit application (Plan 3)
- `crates/kb-bench/`: engine benchmarks (Plan 2)
- `bench/ts/`: the TypeScript baseline; imports the Raycast repo through the gitignored `bench/ts/kb` symlink
- `fixtures/`: corpora, queries, goldens
- `docs/`: ADRs, experiment, specs and plans

## Core engineering rules

- `kb-domain` must never depend on `gpui*` or `kb-app`, directly or transitively. The `domain-purity` hk step
  enforces it; do not bypass it.
- Follow `~/.agents/skills/rust-best-practices`, and for UI work read the GPUI Kit Coding Guides
  (`~/.agents/skills/gpui-kit`) and Design Guides (`~/.agents/skills/gpui-kit-design-guides`) before deciding.
- Never commit anything from or derived from the private corpus: `fixtures/private*` is gitignored and must stay
  so. Only `fixtures/private.sha256` is committed.
- Never write to the Raycast repository (`$KB_TS_REPO`).
- Keep quality gates and thresholds unchanged unless the owner approves the change.

## Naming conventions

- Rust files and modules snake_case, one concept per file; crate directories kebab-case.
- No `mod.rs` + sibling file for the same module; prefer `module.rs` with `module/` children.
- Use the domain vocabulary in [CONTEXT.md](CONTEXT.md).

## Setup

```bash
mise run setup
```

## Validation

```bash
mise run gate
```

It runs, in order, stopping at the first failure: `cargo nextest run`, `cargo clippy -D warnings`,
`cargo build --release`, `hk check --all`, `cargo deny check`, `cargo doc -D warnings`.

## Testing expectations

- Write the failing test first. Tests sit beside the code in `#[cfg(test)]` modules; integration tests in
  `crates/*/tests/`.
- Engine behaviour is checked against goldens from the TypeScript engine, never against hand-copied expectations.

## Commits

Conventional Commits with a sentence-case subject, at most 72 characters.
