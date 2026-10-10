# Archived: tier 2 and 3 before the visual polish

Not used by the report (`xtask` reads only the top level of `results/`). Kept as a record of what was measured and why
it was set aside. Tier 1 stays in `results/`: the engine is unchanged and Plan 5 does not re-run it.

## Why each set is invalid

- **Session of 2026-10-10 (`*-20261010T04*`)**, from `mise run bench:session` at `44fedfa`:
  - kb opened with the split pane showing the notes; Raycast's kb Search opens on the list alone. kb did more work per
    keystroke and held more memory than the screen it was compared with. Fixed in `1cc355b`.
  - kb's interface is due for a visual polish (colours, typography, spacing) that may change its memory and frame
    times; kb is re-measured as it will ship.
  - Raycast's memory runs typed their 100 queries into Raycast's root search, not kb Search: `drive-queries.sh` cleared
    the field before typing, and ⌫ in an empty field pops Raycast to its root search. Fixed in `18be397`. Those files
    were deleted, along with a rerun that measured Raycast warm after the other runs while kb is measured from a fresh
    launch.
  - Still sound, for reference: Raycast's cold-start CPU (`tier2-ts-cpu-*-20261010T045156Z`), latency
    (`tier3-raycast-20261010T045750Z`, hotkey `44 cmd+opt`) and ⌘↩ (`tier3-raycast-action-20261010T045931Z`), and
    both sizes. They are archived with the rest so the next session is measured in one sitting.
- **Before Plan 5 (`*-20261008T*`, `*-20261009T*`)**: Raycast's RSS and CPU, both sizes. Superseded by the next session;
  they predate the session method (`docs/experiment/methodology.md`, "Session").
