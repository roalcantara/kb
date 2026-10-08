# 0002. Keep the Raycast index schema

- Status: accepted
- Date: 2026-10-08

## Context

Comparing search speed and results is only meaningful if both engines query the same data the same way.

## Decision

`kb-domain` creates the same `entries`, `entries_fts` (FTS5 over title, description, notes) and `entry_tags`
tables with the same SQL, through `rusqlite` with its bundled SQLite. The database is the app's own file; the
Raycast index is never opened.

## Consequences

Ranking can be compared with goldens. Results with equal rank have no defined order — SQLite builds differ
between Node, Bun and `rusqlite` — so golden comparisons treat a run of equal sort keys as a set.
