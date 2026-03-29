<!-- markdownlint-disable-file -->
# KLI — Typed run context (args / opts)

## INTRO

Handlers today receive `args` and `opts` as untyped flat records. This spec
requires a **resolved** view: typed values plus provenance (user vs env vs
default) and a stable validity signal after hard validation.

---

## REQUIREMENTS

### REQUIREMENT 1: Resolved cells

**User story:** As a command author, I want each arg and opt exposed as a small
object so I can read the value and how it was resolved.

#### ACCEPTANCE CRITERIA

1. WHEN the handler runs after successful validation, THE SYSTEM SHALL expose
   each declared arg and each merged opt (globals + command, local wins at type
   level per key) as a **cell** with at least: `value`, `source`, `isPresent`,
   and `isValid`.
2. THE `source` field SHALL distinguish at minimum: `argv`, `env`, `default`,
   and `unset` (optional absent).
3. THE `isPresent` field SHALL be true when the effective value came from argv
   or env, and false when from schema default or unset.
4. THE `isValid` field SHALL be `true` for every cell passed to the handler
   after hard validation (handler does not run on validation failure).

### REQUIREMENT 2: Type inference from definitions

**User story:** As a command author, I want TypeScript to derive cell value
types from `args` / `opts` defs and merged globals.

#### ACCEPTANCE CRITERIA

1. WHEN a command declares `args` and `opts`, THE SYSTEM SHALL type `run(ctx)`
   such that `ctx.args` and `ctx.opts` keys match defs (args: variadic keys
   stripped; opts: merged global + local with `Omit<Globals, keyof Local> &
   Local`).
2. WHEN a scalar def uses `type: 'file'`, THE resolved `value` type SHALL be
   `string` at the type level (path), consistent with existing runtime
   behaviour.

### REQUIREMENT 3: Globals slice unchanged (phase 1)

**User story:** As a command author, I want `ctx.globals` to remain a flat map
of global option values for ergonomic access.

#### ACCEPTANCE CRITERIA

1. WHEN global options are merged into `ctx.opts` as cells, THE SYSTEM SHALL
   still populate `ctx.globals` with resolved scalar values for global keys
   only (existing behaviour).

### REQUIREMENT 4: Tests and migration

**User story:** As a maintainer, I want regression tests for provenance and
updated consumer commands.

#### ACCEPTANCE CRITERIA

1. THE SYSTEM SHALL include tests that assert `source` is `argv` vs `default`
   vs `env` for representative parses.
2. THE consumer app commands SHALL use `.value` / `.source` on cells where
   they read args or opts.

---

## OUT OF SCOPE (follow-ups)

- Soft validation or invalid values inside `run` without failing earlier.
- Re-typing `ctx.globals` as cells (phase 2).
