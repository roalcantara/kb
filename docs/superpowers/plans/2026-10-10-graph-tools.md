# Code graph tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking. You implement, update `TODO.md`, self-review, commit and push the
> branch; you do **not** open the pull request or merge: the owner's reviewer does, after reviewing your branch.

**Goal:** CRG, Gortex and Graphify graphs of kb for agents: one `mise run graph` task, `mise doctor project` checks,
MCP and skills wiring, and refreshes after agent edits and after every commit, merge and checkout.

**Architecture:** Port the Raycast repo's tooling into `tools/graph/` (a Bun script and its task, included from
`mise.toml`), its doctor checks into `mise.toml`, its agent wiring into `.mcp.json`, `.agents/skills/` and
`.claude/settings.json`; add hk post-* hooks that start a background update.

**Tech Stack:** mise (tasks, doctor checks, `task_config.includes`), Bun, hk, code-review-graph 2.3.9, Gortex 0.64.7,
Graphify 0.9.79.

**Spec:** [docs/superpowers/specs/2026-10-10-graph-tools-design.md](../specs/2026-10-10-graph-tools-design.md)
(decisions D1–D9). **Source:** `~/Work/raycast/kb` — read only; never write there (AGENTS.md).

---

## Before you start

- Read `AGENTS.md`, `CONTEXT.md`, the spec, and `README.md` ("Project Structure", "Development Workflow").
- `git switch main && git pull && git switch -c feat/graph-tools`.
- Commits: Conventional Commits, sentence-case subject ≤ 72 characters; allowed types `feat fix chore docs style ref
  perf test build ci`. At least one `feat` — it is what releases `v0.2.0` when the branch is merged.
- If a commit hook's `pinact` step fails on GitHub's rate limit, commit with `GITHUB_TOKEN=$(gh auth token) git commit …`.
- If anything below does not behave as written, stop and report it rather than working around it silently.

## File map

| Path                                                                                                 | Change                                                  | Task |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---- |
| `mise.toml`, `mise.lock`, `.github/workflows/ci.yml`, `.fnox.toml`, `.gitignore`                     | pins (fnox too), re-lock, CI skips them, secrets config | 1    |
| `tools/graph/graph.ts`, `tools/graph/tasks.toml`, `mise.toml`                                        | the `graph` task                                        | 2    |
| `mise.toml`                                                                                          | `[doctor.checks.graph_*]`                               | 3    |
| `.mcp.json`, `.agents/skills/`, `.claude/skills` (symlink), `.claude/settings.json`                  | agent wiring                                            | 4    |
| `tools/graph/refresh.sh`, `hk.pkl`                                                                   | post-commit, post-merge, post-checkout refresh          | 5    |
| `hk.pkl`, `.ls-lint.yml`, `.gitignore`, `README.md`, `AGENTS.md`, `tools/graph/README.md`, `TODO.md` | layout guard, docs                                      | 6    |

### Task 1: Pin the tools

- [ ] In `mise.toml` `[tools]`, add (keep the table's alphabetical-ish grouping; `mise fmt` decides):

```toml
# Code graphs for agents (tools/graph/README.md)
"github:zzet/gortex" = "0.64.7"
"pipx:code-review-graph" = "2.3.9"
"pipx:graphifyy" = "0.9.79"
# The interpreter the pipx tools run on: mise probes `python` on PATH before installing one (2026.10.7).
python = "3.13.16"
# Secrets for Graphify's LLM pass (and GITHUB_TOKEN), resolved from password-store (.fnox.toml)
fnox = "1.39.0"
```

- [ ] Copy `~/Work/raycast/kb/.fnox.toml` to the repo root unchanged: it names `pass` entries
      (`tokens/github.com`, `tokens/DEEPSEEK_API_KEY`), never secret values. In `.gitignore`, under a
      `# fnox: local overrides, never committed.` comment, add `/fnox.local.toml` and `/.fnox.local.toml`.

- [ ] `mise install` then `GITHUB_TOKEN=$(gh auth token) mise lock`. Expected: `✓ Lockfile written`, and
      `.mise/locks/` gains `pipx-code-review-graph` and `pipx-graphifyy` folders.
- [ ] `.github/workflows/ci.yml`: extend `MISE_DISABLE_TOOLS` to
      `tokei,cargo:https://github.com/RayanBO/todo/,github:zzet/gortex,pipx:code-review-graph,pipx:graphifyy,fnox,pipx:commit-check,python`, and
      its comment to "Tools in mise.toml that no CI job runs".
- [ ] Check fnox: `fnox list -P default --sources` lists `GITHUB_TOKEN` and `DEEPSEEK_API_KEY`;
      `fnox exec -- sh -c 'test -n "$DEEPSEEK_API_KEY"' && echo resolved`. If `pass` has no such entry on this machine,
      report it and go on: the key is only needed for `--force`.
- [ ] `mise fmt && taplo fmt mise.toml && hk check --all`. Expected: pass (gitleaks too: `.fnox.toml` holds no secret).
- [ ] Commit: `build: Pin the code graph tools and fnox in mise`.

### Task 2: The `graph` task

- [ ] Create `tools/graph/tasks.toml`:

```toml
# The code graph tools (tools/graph/README.md), included from the root mise.toml. An included file is a flat list of
# tasks: each [header] is a task name, with no [tasks.] prefix.

[graph]
description = "Manage the code graphs agents use: code-review-graph (CRG), Gortex and Graphify"
run = "bun tools/graph/graph.ts"
```

then add, after `run`, a `usage = '''…'''` copied verbatim from `~/Work/raycast/kb/mise.toml`, the `usage` value of
`[tasks.graph]` (from `usage = '''` to its closing `'''`, about lines 239–289).

- [ ] Create `tools/graph/graph.ts` from the same task's `run = '''…'''` body (from `#!/usr/bin/env bun` to the line
      before the closing `'''`, about lines 291–519), dedented by two spaces, with these changes and no others:
  1. First lines, after the shebang:
     `// mise run graph (tools/graph/tasks.toml): install, set up, build or update the code graphs.`
     `// Ported from the kb Raycast repo; mise passes the arguments as usage_* environment variables.`
  2. `install.crg`: do not run `code-review-graph install` (it would rewrite the committed `.mcp.json` with an
     unpinned `uvx` server). Print instead: `CRG: .mcp.json, .agents/skills and .claude/settings.json are committed; nothing to install`.
  3. `update.gortex`: never start the daemon. Replace its body with: if `gortex` is missing, print
     `gortex not found (ignored)`; else run `gortex daemon status` read-only and quiet; when it succeeds, run
     `gortex daemon reload` (quiet) and print `gortex reloaded`; otherwise print
     `gortex daemon not running — skipped (mise run graph setup gortex starts it)`.
- [ ] In `mise.toml` `[task_config] includes`, add `"tools/graph/tasks.toml"` after the benchmark kit's entry, outside
      the kit's marked block, with the comment `# The code graph tools (tools/graph/README.md).`
- [ ] Check: `mise tasks | grep '^graph'` lists it; `mise run graph update --dry-run` prints one `would run` per tool
      (or `… not found (ignored)`); `mise run graph install --dry-run` prints the CRG message from change 2;
      `mise run graph update crg` exits 0.
- [ ] Commit: `feat(tools): Add the graph task for agents' code graphs`.

### Task 3: Doctor checks

- [ ] Copy `~/Work/raycast/kb/mise.toml` lines 3–75 (`[doctor.checks.graph_crg_installed]` through
      `[doctor.checks.graph_graphify_gitignore]`) into kb's `mise.toml`, after `[settings]`, under the comment
      `# Code graph health (tools/graph/README.md): mise doctor project.` Change only:
  - `graph_crg_mcp`'s hint to "`.mcp.json` is committed: restore it with `git checkout -- .mcp.json`.";
  - `graph_crg_installed`, `graph_gortex_installed`, `graph_graphify_installed` hints to "Run `mise install`."

  and add, after them:

```toml
[doctor.checks.graph_fnox_secrets]
description = "fnox resolves the secrets in .fnox.toml (Graphify's --force pass needs an LLM key)"
run = "fnox list -P default --sources >/dev/null 2>&1"
hint = "Run `mise install`; fnox reads password-store (`pass`): see .fnox.toml for the entries it expects."
```

- [ ] `mise run graph setup crg && mise run graph setup graphify && mise run graph setup gortex`, then
      `mise doctor project`. Expected: every `graph_*` check passes (`graph_fnox_secrets` needs `pass` set up on this machine; report it if not). Note in your final report that `setup gortex`
      tracked the repo and started Gortex's daemon on this machine.
- [ ] Commit: `build: Add mise doctor checks for the code graphs`.

### Task 4: Agent wiring

- [ ] `.mcp.json`:

```json
{
  "mcpServers": {
    "code-review-graph": { "command": "mise", "args": ["x", "--", "code-review-graph", "serve"], "type": "stdio" }
  }
}
```

- [ ] Copy `~/Work/raycast/kb/.claude/skills/{debug-issue,explore-codebase,refactor-safely,review-changes}/SKILL.md`
      to `.agents/skills/<same>/SKILL.md`, unchanged. Then `mkdir -p .claude && ln -s ../.agents/skills .claude/skills`
      (a relative symlink, committed).
- [ ] `.claude/settings.json`: copy `~/Work/raycast/kb/.claude/settings.json` unchanged (the `PostToolUse` CRG update
      and the `SessionStart` CRG status hooks).
- [ ] Check: `ls .claude/skills/` lists the four; `jq . .mcp.json .claude/settings.json` parses; in this repo,
      `mise x -- code-review-graph status` reports the graph built in Task 3.
- [ ] Commit: `build: Wire the code graphs into agents`.

### Task 5: Refresh after commits, merges and checkouts

- [ ] Create `tools/graph/refresh.sh` (`chmod +x`):

```bash
#!/usr/bin/env bash
# Run by hk after each commit, merge and checkout (hk.pkl): starts `mise run graph update` in the background, one
# run at a time, logging to tmp/graph-update.log, and returns at once. Never in CI.
set -euo pipefail

[ -z "${CI:-}" ] || exit 0
mkdir -p tmp
lock=tmp/graph-update.lock
mkdir "$lock" 2>/dev/null || exit 0 # an update is already running
(
  trap 'rmdir "$lock"' EXIT
  mise run graph update >tmp/graph-update.log 2>&1
) </dev/null >/dev/null 2>&1 &
```

- [ ] `hk.pkl`: before `hooks {`, add

```pkl
// Code graphs (tools/graph/README.md) follow every commit, merge and checkout. The step returns at once and never
// fails git: the update runs in the background.
local graph_refresh_steps = new Mapping<String, Step> {
    ["graph-refresh"] {
        check = "tools/graph/refresh.sh"
        allow_failure = true
    }
}
```

and inside `hooks { … }`:

```pkl
["post-commit"] { steps = graph_refresh_steps }
["post-merge"] { steps = graph_refresh_steps }
["post-checkout"] { steps = graph_refresh_steps }
```

- [ ] `hk install --mise`, then `git config --get-regexp '^hook\.'`. Expected: entries for `post-commit`,
      `post-merge` and `post-checkout` beside the existing hooks. If hk is installed globally (`~/.gitconfig` has
      `hook.hk-*`), the global hooks already cover them; say which in your report.
- [ ] Check: make a commit (this task's), then within a few seconds `ls tmp/graph-update.lock` may exist and
      `tmp/graph-update.log` ends with each tool's update line; `git status --short` stays clean. Then
      `git switch main && git switch -` refreshes again (log rewritten). The commit itself returns in about the time it
      did before.
- [ ] Commit: `feat(tools): Refresh the code graphs after commits and checkouts`.

### Task 6: Layout, docs, TODO

- [ ] `hk.pkl` `root-layout`: allow the two new hidden folders —
      `grep -v -x -E '\.agents|\.claude|\.github|\.mise|crates|docs|tools'` — and its comment.
- [ ] `.ls-lint.yml`: the root `.dir` regex becomes `regex:^([a-z0-9-]+|\.agents|\.claude|\.github|\.config)$`.
- [ ] `.gitignore`, local-state block: add `/.gortex/` beside `/graphify-out/` and `/.code-review-graph/`.
- [ ] `tools/graph/README.md`: what each tool is for (CRG: MCP graph queries, impact and review; Gortex: daemon-backed
      queries, `gortex wakeup`/`context` briefings; Graphify: `graphify-out/GRAPH_REPORT.md` and `graph.html`); the
      commands (`mise run graph setup` once; `update`, `build`, `--force` for Graphify's LLM pass, `--dry-run`); what
      refreshes automatically (Claude Code hooks; hk post-commit/merge/checkout → `tmp/graph-update.log`);
      `mise doctor project`; secrets (`.fnox.toml`: `--force` runs Graphify through `fnox exec`, which resolves
      `DEEPSEEK_API_KEY` from password-store; keys can also come from the environment); global side effects (spec D6);
      and how to remove it all (the folder, the `includes` line,
      the four pins, the doctor checks, `.fnox.toml`, `.mcp.json`, `.agents/skills`, `.claude/`, the hk hooks).
- [ ] `README.md` "Project Structure": add `tools/graph/` to the tree and a bullet for `.agents/` and `.claude/` beside
      the hidden-folders bullet; "Development Workflow" table: `mise run graph setup` and `mise doctor project` rows.
- [ ] `AGENTS.md` "Repository map": `- tools/graph/: code graphs for agents (CRG, Gortex, Graphify); use them before a
      broad search: tools/graph/README.md`.
- [ ] `TODO.md`, with the `todo` CLI (REF comments at its end): add and mark done a task for this work (tags
      `tools,graph`, position `tools/graph/README.md`); add pending low-priority tasks "Run Graphify's semantic pass
      (`mise run graph build graphify --force`) once API keys are in fnox" and "Decide whether CI should publish a
      graph report".
- [ ] `dprint fmt && hk check --all && mise run gate`. Expected: all pass.
- [ ] Commit: `docs: Document the code graph tools`.

### Task 7: Self-review and hand-off

- [ ] `git diff main --stat` and read the whole diff: no file from `~/Work/raycast/kb` beyond those named here; no
      generated graph output committed (`git ls-files | grep -E 'graphify-out|\.code-review-graph|\.gortex'` is
      empty); `git log main..` has at least one `feat`.
- [ ] `git push -u origin feat/graph-tools`. Do not open the pull request.
- [ ] Report: commits, check results (doctor output, refresh log tail, gate), the hk install mode, global side effects
      on this machine, and anything that deviated from this plan.
