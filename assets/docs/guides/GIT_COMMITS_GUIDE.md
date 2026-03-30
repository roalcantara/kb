---
title: Commit message guidelines
description: Conventional Commits for this repo (primary reference)
---

# Commit Message Guidelines

Cursor rule (summary): `.cursor/rules/git-commits.mdc`

Extended background: [`GIT_GUIDE.md`](./GIT_GUIDE.md).

All commits should follow these guidelines for consistency and tooling (e.g. changelog).

## Format (Conventional Commits)

```gitcommit
<type>(<scope>): <description>

<body>

<footer>
```

### Types

- `feat` - new feature
- `fix` - bug fix
- `docs` - documentation changes
- `style` - formatting, missing semicolons (no logic change)
- `ref` - refactoring without new features
- `test` - adding or updating tests
- `chore` - maintenance tasks, dependency updates
- `ci` - CI/CD changes
- `build` - build system changes (mise.toml, bun config)

### Scope

The area of the codebase affected. Examples: `cli`, `domain`, `adapters`, `sqlite`, `config`, `show`, `search`.

## Subject Line Rules

Follow the [7 rules of a great Git commit message](https://cbea.ms/git-commit):

1. Separate subject from body with a blank line
2. **Limit subject line to 50 characters** (strict maximum)
3. Capitalize the subject line (first letter)
4. Do not end subject line with a period
5. **Use imperative mood** - "Add feature" not "Added" or "Adds"
6. Wrap body at 72 characters
7. **Explain WHAT and WHY, not HOW** (code shows how)

## Atomic Commits

Each commit must represent a **single logical change**:

```
❌ Bad:  "Add show command and fix search and update config"
✅ Good: "feat(cli): Add show command with glow markdown render"
         "fix(search): Handle empty FTS query correctly"
         "ref(config): Extract default values to constants"
```

## Standard Commit Format

```
feat(<scope>): <imperative description ≤50 chars>

<WHAT + WHY - one sentence explaining intent>

Changes:
- High-level capability or intent (what it enables)
- Another capability (avoid low-level implementation details)

References:
- Relevant link if applicable
```

## Body Guidelines

**Summary sentence MUST explain both WHAT and WHY.**

```
❌ Bad:  "Create search command"
✅ Good: "Add FTS-powered search to enable fast entry lookup across all types"
```

**Changes section - focus on intent, not implementation details:**

```
❌ Bad:
Changes:
- Add query string variable
- Call db.prepare with SQL string
- Loop over rows and push to array

✅ Good:
Changes:
- Enable full-text search across title, desc, tags, and type-specific fields
- Support --type and --tag filters combined with FTS queries
```

## Complete Example

```
feat(cli): Add search command with FTS and filters

Enable fast full-text search across all entry types using
SQLite FTS5, supporting type and tag filter combinations.

Changes:
- Search across title, desc, tags, url, cmd, cheat, task fields
- Combine FTS with --type and --tag filters
- Paginate results with --page and --page-size

References:
- SQLite FTS5: https://www.sqlite.org/fts5.html
```

## Breaking Changes

```
feat(cli)!: Change --format default from table to json

BREAKING CHANGE: scripts relying on default table output
must now pass --format table explicitly.
```

## Validation Checklist

Before committing, verify:

- [ ] Subject line ≤50 characters
- [ ] Subject uses imperative mood
- [ ] Subject capitalized, no period
- [ ] Blank line between subject and body
- [ ] Body wrapped at 72 characters per line
- [ ] Summary explains WHAT + WHY
- [ ] Changes focus on intent, not implementation details
- [ ] Follows Conventional Commits format

## Common Subject Patterns

```txt
feat(cli): Add <command> command
feat(adapters): Implement <adapter> for <purpose>
feat(domain): Add <rule/entity> for <purpose>
fix(<scope>): Fix <issue> in <component>
test(<scope>): Add tests for <behavior>
ref(<scope>): Refactor <component> to <improve>
docs(*): Update README with <topic>
build(*): Add <task> mise task for <purpose>
```

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [How to Write a Git Commit Message](https://cbea.ms/git-commit)
- [Atomic Git Commits](https://www.aleksandrhovhannisyan.com/blog/atomic-git-commits/)
