---
title: Mise task guidelines
description: When to use mise tasks vs bun run; no ad-hoc project scripts
---

# Mise Task Preference Guidelines

Cursor rule (summary): `.cursor/rules/mise-tasks.mdc`

## Overview

This project uses Mise as the primary task runner for all complex workflows.
Always prefer `mise run <task>` over direct shell commands for complex tasks.

## Why Mise Tasks?

1. **Consistency** - same execution across all environments
2. **Documentation** - tasks are self-documenting
3. **Dependencies** - tasks can define complex workflows
4. **Environment Management** - Mise handles tool versions via `mise.toml` at the repo root
5. **Cross-platform** - works consistently across macOS and Linux

## Guidelines

### ❌ Avoid: Direct Shell Commands

```bash
# Avoid
bun build index.ts --compile --outfile dist/kb
bun test
biome check --write .
bun tsc --noEmit
```

### ✅ Prefer: Package JSON Scripts for simple tasks

```bash
# Prefer
bun run build:prod
bun run test
bun run lint:fix
```

### When Direct Commands Are Acceptable

Only use direct commands when:

1. No equivalent mise task exists
2. You need custom parameters not supported by existing tasks
3. You are debugging or exploring new functionality

### No Standalone Scripts

Do not add ad-hoc shell scripts to the repository. If automation is needed,
add a Mise task to `mise.toml` (tasks can run bash, Bun, etc. *But not ad-hoc scripts*!).

**Exception:** Scripts used exclusively by Cursor and living under `.cursor/` (e.g. hook scripts like `.cursor/hooks/dod-check.ts`) are allowed. The “no scripts” rule applies to **project** automation and tasks (e.g. build, test, release); Cursor-specific hooks are editor integration, not project tasks.

### Adding New Mise Tasks

If you need functionality not covered by existing tasks:

1. Add the task to `mise.toml`
2. Include a `description` field
3. Follow naming conventions (`verb` or `noun:verb` style)
4. Define task dependencies if needed

## Implementation Notes

- All tasks are defined in `mise.toml` at the project root
- Run `mise tasks` or `mise run --list` to see all available tasks
- Tasks handle environment setup and proper error output

## REFERENCES

- [Mise Documentation][0]
- [Bun CLI][1]
- [Biome][2]

[0]: https://mise.jdx.dev/ 'Mise Documentation - Dependency management and task runner'
[1]: https://bun.com/docs 'Bun — runtime, package manager, bundler, test runner'
[2]: https://biomejs.dev/ 'Biome - JavaScript/TypeScript linter and formatter'
