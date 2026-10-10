# Code graph tools — design

- Status: approved
- Date: 2026-10-10

## Goal

Implementer agents get three code graphs of kb — code-review-graph (CRG), Gortex and Graphify — that stay current
without anyone remembering to refresh them, plus one task to install, build, update and diagnose them. The tooling is
the Raycast repo's (`~/Work/raycast/kb` at `8aa510c`), ported and adapted, not rewritten.

## Findings

- All three index kb's Rust, at the Raycast repo's pins, checked on a scratch worktree on 2026-10-10: CRG 2.3.9 — 85
  files, 562 nodes, 5,619 edges; Graphify 0.9.79 code-only update (no LLM, no key) — 1,117 nodes, 72 communities;
  Gortex 0.64.7 — 188 files, 3,114 nodes, 9,816 edges.
- The Raycast repo has: `mise run graph <install|setup|build|update> [all|crg|gortex|graphify]` (a Bun script in
  `mise.toml`, lines 237–520, with `--dry-run`, `--fix`, `--timeout`, and an opt-in Graphify LLM pass `--force
  --backend …` whose keys come from `fnox` when present); eleven `[doctor.checks.graph_*]` (`mise.toml`, lines 3–75)
  run by `mise doctor project`; `.mcp.json` serving CRG; four CRG skills in `.claude/skills/`; Claude Code hooks in
  `.claude/settings.json` (CRG update after Edit/Write, status at session start). No git hook refreshes a graph.
- hk runs custom `post-commit`, `post-merge` and `post-checkout` hooks; a step with `allow_failure` never fails git.
  hk has no background mode, so the step starts the work in the background itself.

## Decisions

**D1. One folder, `tools/graph/`.** `graph.ts` (the Raycast Bun script, moved from inline TOML to a file), `tasks.toml`
(the `graph` task: same `usage` block, `run = "bun tools/graph/graph.ts"`), `refresh.sh` (the hooks' background
update), `README.md` (what each tool is for, commands, what refreshes automatically, how to remove it all). Included
from `mise.toml` through `task_config.includes`, beside the benchmark kit.

**D2. Pins in the project.** `pipx:code-review-graph = "2.3.9"`, `pipx:graphifyy = "0.9.79"`,
`"github:zzet/gortex" = "0.64.7"` join `mise.toml`, and `mise.lock` is re-locked. CI never installs them: they join
`MISE_DISABLE_TOOLS` in `.github/workflows/ci.yml`.

**D3. Health in `mise doctor project`.** The eleven checks are ported, adapted to kb's paths; each keeps its fix hint.

**D4. Agents reach them.** `.mcp.json` serves CRG through the pinned binary (`mise x -- code-review-graph serve`), not
`uvx`. The four CRG skills live in `.agents/skills/` — the cross-agent location, as `~/.agents/skills` — and
`.claude/skills` is a symlink to it, because Claude Code reads only `.claude/skills`. `.claude/settings.json` carries
the Raycast repo's two Claude Code hooks. AGENTS.md says to use the graphs before a broad search.

**D5. Fresh graphs after every change, locally.** Two paths:

- Claude Code hooks (D4): CRG after each Edit or Write; status at session start.
- hk `post-commit`, `post-merge`, `post-checkout`: one step runs `tools/graph/refresh.sh` with `allow_failure`. It
  exits at once in CI, starts `mise run graph update` in the background with a lock so runs never overlap, and logs to
  `tmp/graph-update.log`. A git command never waits for it or fails because of it.

**D6. Global side effects are explicit.** Only `graph install` (CRG's `.mcp.json`; Gortex's and Graphify's own installs
into the user's agent configs) and `graph setup gortex` (repo tracking, daemon) reach outside the repo. `graph update`
— what the hooks run — never starts Gortex's daemon: it reloads it when running and skips Gortex otherwise. CRG installs
with `--no-instructions`, so `CLAUDE.md` stays `@AGENTS.md @CONTEXT.md`.

**D7. Graphify's LLM pass is opt-in.** Automatic updates are code-only (no LLM, no key, no cost);
`mise run graph build graphify --force [--backend …]` runs the semantic pass on request. Its keys come from fnox: `fnox = "1.39.0"` is
pinned, `.fnox.toml` (copied from the Raycast repo) names the `pass` entries — references, never values — and
`fnox.local.toml` overrides stay ignored. CI skips fnox.

**D8. The layout guard knows the new hidden folders.** `root-layout` and ls-lint allow `.agents` and `.claude`; README's
"Project Structure" lists them and `tools/graph/`. Graph output (`graphify-out/`, `.code-review-graph/`, `.gortex/`)
stays gitignored.

**D9. Released.** At least one commit is a `feat`, so merging releases `v0.2.0` through the CI of ADR 0007.

## Scope

In: D1–D9, a plan an implementer agent executes on branch `feat/graph-tools` (implement, `TODO.md`, self-review,
commits, push), then review, pull request, merge on green and the `v0.2.0` release by the owner's reviewer.

Out: graphs in CI; Graphify docs or images (`/graphify` in an agent session covers them); any change to the Raycast
repository, which is only read.
