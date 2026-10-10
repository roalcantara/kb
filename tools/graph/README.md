# Code Graph Tools

Tools for agents to query and navigate the repository via code graphs: code-review-graph (CRG), Gortex, and Graphify.

## Overview

Three complementary code graphs index `kb`'s Rust codebase:

- **code-review-graph (CRG)**: MCP server delivering graph queries, structural blast radius, and PR/commit impact analysis directly to LLM agents.
- **Gortex**: Daemon-backed code graph providing fast codebase queries and contextual briefings (`gortex context`, `gortex wakeup`).
- **Graphify**: Generates standalone visual and structural artifacts in `graphify-out/` (`graphify-out/GRAPH_REPORT.md`, `graph.html`, and `graph.json`).

## Commands

All actions are driven by `mise run graph <action> [tool]`:

```bash
# Setup: initialize repository graphs (run once)
mise run graph setup

# Incremental update: refresh changed files (AST-only, fast, no LLM required)
mise run graph update

# Rebuild: CRG from scratch, Graphify code-only (from scratch only with --force), Gortex reloaded
mise run graph build

# Semantic LLM pass (Graphify only): runs extraction and community labelling via LLM
mise run graph build graphify --force [--backend deepseek,gemini]

# Dry run: preview commands without modifying graph state
mise run graph update --dry-run
```

## Automatic Refreshes

Graphs stay up-to-date automatically during development:

1. **Claude Code Hooks (`.claude/settings.json`)**: Refreshes CRG incrementally on `PostToolUse` (after `Edit` or `Write`), and checks CRG graph status on `SessionStart`.
2. **Git Lifecycle Hooks (`hk.pkl` & `tools/graph/refresh.sh`)**: Runs `mise run graph update` in the background after `post-commit`, `post-merge`, and `post-checkout`. Progress is logged to `tmp/graph-update.log`. The update uses an exclusive file lock (`tmp/graph-update.lock`) so runs never overlap and git operations never block.

## Health Diagnostics

Run `mise doctor project` to verify graph toolchain health, installed binaries, MCP wiring, and gitignore status across all three tools.

## Secrets and fnox

Graphify's optional semantic pass (`--force`) runs through `fnox exec`, which reads password-store (`pass`) via `.fnox.toml` (e.g. `DEEPSEEK_API_KEY`). API keys can also be supplied directly through environment variables. Local fnox overrides belong in `.fnox.local.toml` or `fnox.local.toml`, which are gitignored.

## Global Side Effects

Following spec decision D6, global state modifications outside this repository are strictly scoped:

- `mise run graph install` configures agent configuration files in user home directories (e.g. MCP registration, agent skills).
- `mise run graph setup gortex` registers this repository with Gortex (`gortex track`) and starts its background daemon.
- `mise run graph update` (run by git hooks) never starts the Gortex daemon; it reloads the daemon only if already running, and skips it otherwise. CRG needs no install: its wiring (`.mcp.json`, `.agents/skills`, `.claude/settings.json`) is committed, so `CLAUDE.md` stays untouched.

## Removal

To completely remove the code graph tooling from this repository:

1. Delete `tools/graph/`.
2. Remove `"tools/graph/tasks.toml"` from `[task_config] includes` in `mise.toml`.
3. Remove the tool pins (`gortex`, `code-review-graph`, `graphifyy`, `fnox`) from `[tools]` in `mise.toml`.
4. Remove `[doctor.checks.graph_*]` from `mise.toml`.
5. Remove `.fnox.toml`, `.mcp.json`, `.agents/skills`, and `.claude/`.
6. Remove the `graph-refresh` steps and hooks (`post-commit`, `post-merge`, `post-checkout`) from `hk.pkl`.
