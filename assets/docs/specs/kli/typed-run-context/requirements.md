<!-- markdownlint-disable-file -->
# KLI — Typed run context (args / opts)

## INTRO

Handlers receive `args`, `opts`, and `globals` as **typed flat records**.
Resolution (argv/env/default), coercion, and validation happen before `run`
executes; handlers are called only on success.

---

## REQUIREMENTS

### REQUIREMENT 1: Flattened resolved maps

**User story:** As a command author, I want `ctx.args`, `ctx.opts`, and
`ctx.globals` to be ergonomic, typed flat records so I can read values without
additional `.value` indirection.

#### ACCEPTANCE CRITERIA

1. WHEN the handler runs after successful validation, THE SYSTEM SHALL expose:
   - `ctx.args`: resolved positional args map
   - `ctx.opts`: merged resolved options map (globals + local; local wins on key)
   - `ctx.globals`: resolved globals-only map (global keys only)
2. `ctx.opts` SHALL include global keys as well as command-local keys.
3. `ctx.globals` SHALL include only global keys that are not shadowed by a
   command-local opt with the same key; for overlapping keys, the merged
   resolved value SHALL be accessible only via `ctx.opts`.
4. Provenance (argv vs env vs default) SHALL NOT be exposed in the handler
   context in the current implementation.

### REQUIREMENT 2: Type inference from definitions

**User story:** As a command author, I want TypeScript to derive cell value
types from `args` / `opts` defs and merged globals.

#### ACCEPTANCE CRITERIA

1. WHEN a command declares `args` and `opts`, THE SYSTEM SHALL type `run(ctx)`
   such that `ctx.args` and `ctx.opts` keys match defs (args: variadic keys
   stripped; opts: merged global + local with local winning by key).
2. WHEN a scalar def uses `type: 'file'`, THE resolved `value` type SHALL be
   `string` at the type level (path), consistent with existing runtime
   behaviour.

### REQUIREMENT 3: Raw parse object

**User story:** As a maintainer, I want handlers and middleware to have an
escape hatch for parse diagnostics without re-parsing argv.

#### ACCEPTANCE CRITERIA

1. THE SYSTEM SHALL provide `ctx.raw` as the parsed argv object (including
   `errors`, `commandName`, `commandArgv`, etc.).

### REQUIREMENT 4: Tests and migration

**User story:** As a maintainer, I want regression tests and stable migration
guidance for the flattened context shape.

#### ACCEPTANCE CRITERIA

1. THE SYSTEM SHALL include tests that validate:
   - global + local opt merge
   - `globals` slice behavior
   - required arg/opt validation prevents handler execution
2. Consumer app commands SHALL read scalar values directly from `args` / `opts`
   / `globals` (no `.value` indirection).

---

## OUT OF SCOPE (follow-ups)

- Provenance/cells (`{ value, source, isPresent, isValid }`) for args/opts.
- Exposing resolution details (argv/env/default) to handlers.
