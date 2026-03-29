---
title: Code Style Guide
description: Coding patterns, 12-Factor, and SOLID principles for kodexb
---

# Coding Style Guide

Cursor rule (summary): `.cursor/rules/codestyle.mdc`

## Core Principles

- **Prefer simple solutions** — Avoid unnecessary abstraction
- **DRY** — Check for existing similar code before adding new logic. Never repeat code; abstract into a shared function or module.
- **Minimal changes** — Only make requested changes or well-understood related changes
- **Exhaust first** — When fixing a bug, exhaust existing implementation options before introducing new patterns or technologies. If you do introduce a new one, remove the old implementation to avoid duplicate logic.
- **Clean and organized** — Keep the codebase easy to navigate and reason about

## Non-Negotiable Rules

- **No magic numbers or strings** — Extract to named constants. Paths, limits, regex patterns, and any literal that carries meaning must have a single source of truth.
- **Abstract repeated logic** — If you copy-paste, stop. Extract a function or reuse an existing one.
- **Open for extension, closed for modification** — Add new formatters, commands, or modules instead of branching inside existing ones. Prefer registries and polymorphism over switch/if chains.

## Type Definitions

- **Inline simple single-use types** — If a type is used only once and has ≤3 properties, prefer inline definition over extracted type alias. Extraction adds indirection without benefit.
- **Extract reusable types** — If a type is used in multiple places, extract it to avoid duplication.
- **Extract complex types** — If a type has many properties or complex validation (Typia tags), extraction improves readability even if used once.
- **Extract semantic types** — If the type name adds significant meaning (e.g., `EntryTypeName`, `ThemeColorName`), extraction is justified.

```typescript
// ❌ Avoid: single-use type with few properties
type FetchConfig = {
  timeout_ms: number
  user_agent?: string
}
export type Config = {
  fetch: FetchConfig  // indirection without benefit
}

// ✅ Prefer: inline simple single-use types
export type Config = {
  fetch: {
    /** @minimum 1 @type int */
    timeout_ms: number
    user_agent?: string
  }
}

// ✅ Keep extracted: reused or semantically meaningful
type EntryTypeName = 'Bookmark' | 'Command' | 'Cheat' | 'Task'
type ThemeElements = Record<EntryTypeName, string>  // reuses EntryTypeName
type ThemeSymbols = Record<EntryTypeName, string>   // reuses EntryTypeName
```

## 12-Factor (adapted for CLI)

Inspired by [The Twelve-Factor App](https://12factor.net). Applied where relevant to a CLI/TUI app:

- **Config** — Store config in environment, files, or flags. Never hardcode paths or secrets.
- **Backing services** — Treat SQLite as an attachable resource (paths via config, swappable in tests).
- **Build/run** — Keep build and run stages separate. No runtime compilation.
- **Dev/prod parity** — Same code path everywhere. Use in-memory SQLite or fixtures in tests.
- **Logs** — Use stdout/stderr. No ad-hoc log files.
- **Admin processes** — One-off tasks (import, validate) run as commands, not background services.

## SOLID (adapted)

- **S — Single Responsibility** — Each function, module, and file has one reason to change.
- **O — Open/Closed** — Extend via new formatters, commands, or modules; avoid modifying existing ones for new behavior.
- **D — Dependency Inversion** — Depend on abstractions (e.g. `AppDeps`). Inject dependencies; don't import concrete I/O from domain code.

## File Naming

### Pattern: `<name>.<suffix>.ts`

Use descriptive suffixes to indicate the artifact type:

| Suffix           | Purpose                                               | Example                                 |
| ---------------- | ----------------------------------------------------- | --------------------------------------- |
| `.schema.ts`     | Validation schemas or shared input types (e.g. Typia) | `config.schema.ts`                      |
| `.loader.ts`     | File/resource loading logic                           | `config.loader.ts`                      |
| `.service.ts`    | Business logic orchestration                          | `app.service.ts`, `format.service.ts`   |
| `.command.ts`    | CLI command definitions                               | `info.command.ts`                       |
| `.formatter.ts`  | Output formatting logic                               | `info.formatter.ts`                     |
| `.page.tsx`      | TUI page components (Ink)                             | `list.page.tsx`                         |
| `.component.tsx` | Reusable TUI components (Ink)                         | `header.component.tsx`                  |
| `.config.ts`     | Configuration constants/defaults                      | `defaults.config.ts`, `theme.config.ts` |
| `.factory.ts`    | Object/instance creation                              | `command.factory.ts`                    |
| `.spec.ts`       | Unit/integration tests                                | `config.spec.ts`                        |

### Exceptions (no suffix)

Some files follow established TypeScript/Node conventions without suffixes:

| File       | Purpose        | Rationale            |
| ---------- | -------------- | -------------------- |
| `index.ts` | Barrel exports | Universal convention |
| `main.ts`  | Entrypoints    | Universal convention |

### Test Files

- Use `.spec.ts` suffix for unit tests
- Use `.e2e.spec.ts` suffix for end-to-end tests
- Co-locate tests with source: `config.loader.spec.ts` alongside `config.loader.ts`

### Why This Pattern?

1. **Predictability** — File purpose is clear from the name
2. **Discoverability** — Easy to find all services, schemas, or commands
3. **Consistency** — Same pattern across the codebase
4. **Real-world alignment** — Combines NestJS-style suffixes with standard TypeScript conventions for common files

## Folder Naming Conventions

nouns, not verbs (widely used pattern)

Although there is no single ISO standard, but the dominant convention in industry and books is to name packages / modules / feature folders after nouns (the thing or concern), not imperative verbs:

- **Domain-Driven Design** — bounded contexts and modules are named as things (Billing, Inventory, Shipping), not validate or process.
- **Package by feature** — (common in Angular, React, backend services) — folders are feature nouns (auth, profile, checkout).
- **Rails / Django layers** — use plural nouns (models, controllers, views)—again nominal, not doStuff/.
- **Practical rule for topic dirs** - use domain nouns or clear nominalizations:

  | Avoid `(verb-y)` | Rationale                                  | Prefer `(noun / nominal)` |
  | ---------------- | ------------------------------------------ | ------------------------- |
  | validate/        | noun; pairs cleanly with parse/            | validation/               |
  | parse/           | noun; pairs cleanly with validation/       | parsing/                  |
  | argv/            | Matches Bun.argv / parseArgv; Unix-honest. | parsing/                  |
  | run/             | ambiguous                                  | dispatch/ or execution/   |
  | compose/         | often read as verb                         | factories/                |

> **NOTE:** Files inside still use verb phrases in function names (validateCommand, parseArgv)
> and **.service.ts / .factory.ts** suffixes—that is correct;
> the folder is the area, the file is the artefact type.

## Structure

- **File size** — Refactor when files exceed 200–300 lines.
- **Scripts** — Avoid one-off scripts in files. Prefer `mise.toml` tasks.
- **Module ownership** — Serialization of type T lives in T's module (see `.cursor/rules/module-ownership.mdc` and specs under `assets/docs/specs/` when present).

## Behavior

- **Mocking** — Only in tests. Never mock or stub data in dev/prod code.
- **Env files** — Never overwrite `.env` without explicit confirmation.
- **Test data** — Fixtures and in-memory DB for tests; no fake data in app code paths.
