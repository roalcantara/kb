# Repository layout — design

- Status: approved
- Date: 2026-10-10

## Goal

A root with three folders — `crates/`, `docs/`, `tools/` — each named by a widely used convention, and the benchmark
kit isolated in one folder that can be deleted without breaking the product, its tests or the gate.

## Survey

Root folders of twelve Rust repositories (ripgrep, uv, ruff, rust-analyzer, Zed, Helix, Typst, Deno, Nushell, Bevy,
Servo, Tauri), read through the GitHub API on 2026-10-10: `crates/` and `docs/` nearly everywhere; tooling in `tools/`
(Typst, Deno), `tooling/` (Zed), `scripts/` or `xtask/`; test data in `tests/` (Typst, Deno, ripgrep); patched external
code in `third_party/` (Servo, as Chromium and Fuchsia). Cargo and rustc configs stay at the root everywhere; other
tools' configs increasingly move to `.config/` (uv, ruff, rust-analyzer, Zed, Servo).

## Decisions

**D1. Three root folders.** `crates/` (Rust code, ours and patched), `docs/` (ADRs, experiment record, specs, plans),
`tools/` (developer tooling). `.github/` is reserved for CI. An hk step fails when a tracked top-level folder is not
one of these.

**D2. The benchmark kit is `tools/bench/`, purgeable as a unit.** It holds everything that only produces measurements:

| Path                    | Was               | What                                                    |
| ----------------------- | ----------------- | ------------------------------------------------------- |
| `tools/bench/kb-bench/` | `crates/kb-bench` | Rust engine benchmark                                   |
| `tools/bench/report/`   | `crates/xtask`    | report generator, renamed `kb-report`: its only command |
| `tools/bench/ts/`       | `bench/ts`        | TS engine bench and golden writer                       |
| `tools/bench/probes/`   | `bench/probes`    | tier 2 and 3 probes, CGEvent driver                     |
| `tools/bench/fixtures/` | `fixtures/`       | `queries.json`, `private.sha256`; `private*` gitignored |
| `tools/bench/mise.toml` | root `mise.toml`  | bench, fixtures, goldens, parity, probes, report tasks  |
| `tools/bench/README.md` | —                 | what the kit is, and the purge steps                    |

Purging it: delete the folder, then the two workspace members in `Cargo.toml`, the task include in `mise.toml`, and
one marked block each in `hk.pkl` and `.gitignore`.

**D3. The product's test data belongs to the engine.** `fixtures/sample` and `fixtures/sample-goldens` move to
`crates/kb-domain/tests/fixtures/`. kb-domain's golden test and kb-app's tests read them there; the benchmark kit reads
the sample corpus from there too. After a purge the goldens stay, frozen: they are the engine's contract.

**D4. Patched crates are `crates/third-party/`.** `vendor/block` moves to `crates/third-party/block`: it compiles into
the shipped binary, so it is not tooling. It stays outside the workspace (`exclude`), and out of hk and dprint. The
convention's name is `third_party`; ls-lint's directory rule (lowercase, digits, hyphens) makes it `third-party` here.

**D5. Product checks and features stay out of the kit.** The binary size budget is a gate: its file and check script
become `tools/size/` (`budget`, `size.sh`), which the kit's `bench:size` also calls to record a result. `mise run setup`
installs the product's tools; the kit's own setup is `mise run bench:setup`. `kb --trace` and `kb --sync` remain in kb-app: tested diagnostics that the probes use,
not part of the kit. `docs/experiment/` stays in `docs/` as the record.

**D6. Local state is ignored in one block.** `graphify-out/`, `.code-review-graph/` and `.delta/` join `.gitignore`
under one heading.

**D7. One description of the layout.** README's "Project Structure" documents the folders and the rule for each;
AGENTS.md's repository map points to it. Live documents (README, AGENTS, CONTEXT, methodology, Plan 5, the Plan 5
design, ADRs, compliance) get the new paths; earlier plans and specs stay as written, a record of their time.

## Scope

In: D1–D7, a short plan, its execution with the full gate passing, `TODO.md`, merge to `main`, and a push to the
private `roalcantara/kb`.

Out: moving tool configs into `.config/` (a `TODO.md` task, evaluated separately), and deleting the benchmark kit.
