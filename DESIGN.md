# Design system

kb's visual design. The reference is Raycast's kb Search extension: kb copies its anatomy, layout and behaviour, and
departs from it only where [Adaptations](#adaptations) says why. [PRODUCT.md](PRODUCT.md) says what kb is for; this file
says how it looks. Read it before any UI change.

Values live in one place each, and this file points at them:

| What                                       | Source of truth                                                                  | Consumer                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Palette roles (hex)                        | [`tools/design/palettes.json`](tools/design/palettes.json), the `chosen` palette | `theme.mjs` → [`kb.json`](crates/kb-app/assets/themes/kb.json) |
| Derived colours (pills, tints), tag hashes | [`tools/design/color.mjs`](tools/design/color.mjs)                               | `validate.mjs`, `render.mjs`, `theme.mjs`                      |
| Spacing, sizes, radii, alignment           | [`tools/design/layout.json`](tools/design/layout.json)                           | `render.mjs`; the app (Plan 7)                                 |
| Validation results                         | [`tools/design/validation.json`](tools/design/validation.json)                   | the comparison page                                            |

The palette table below repeats the chosen hexes for readers; `validate.mjs` fails when it drifts from `palettes.json`.
`mise run design:palettes` validates every palette, regenerates the theme and opens the comparison page
(`tmp/design/palettes.html`).

## 1. Visual Theme & Atmosphere

A calm, dark navy launcher. Surfaces are flat and close in tone; hierarchy comes from spacing, a soft inset selection
and type weight before any border or card. Colour is reserved for meaning: an entry's type, its tags, and state. The
panel floats over whatever is behind it and never shouts.

## 2. Color Palette & Roles

**Tokyo Night Storm Flat Separated**: Tokyo Night Storm
([folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim/tree/main/extras)), tuned by hand to flatter
surfaces and accents that stay apart under colour-blind simulation. The owner picked it on 2026-10-10 from the
candidates in `palettes.json`.

| Role        | Hex       | Name         | Job                                                         |
| ----------- | --------- | ------------ | ----------------------------------------------------------- |
| `window`    | `#23273A` | Storm navy   | The panel, the list, the detail pane                        |
| `header`    | `#24293E` | Storm header | The search header and title bar                             |
| `selection` | `#2A3047` | Selection    | The selected row, the selected popover item                 |
| `raised`    | `#24293E` | Raised       | Popovers and footer pills                                   |
| `divider`   | `#353D5A` | Divider      | Pane boundaries, popover and card edges; never between rows |
| `text`      | `#CBD4FF` | Text         | Titles, values, search text                                 |
| `textMuted` | `#B2BADB` | Muted text   | Descriptions, labels, shortcut hints                        |
| `textFaint` | `#7A86B6` | Faint text   | The search placeholder, tertiary hints                      |
| `blue`      | `#70B9F4` | Blue         | Cheats; tags                                                |
| `green`     | `#30E1A5` | Green        | Commands; tags                                              |
| `orange`    | `#F5A95D` | Orange       | Notes; tags                                                 |
| `purple`    | `#A362F2` | Purple       | Bookmarks; tags                                             |
| `magenta`   | `#E927AB` | Magenta      | Tasks; tags                                                 |
| `yellow`    | `#D9E753` | Yellow       | Tags                                                        |
| `red`       | `#E04F50` | Red          | Tags; the notes' description bar                            |

- **Type tints** (Raycast's `TYPE_TINTS`): bookmark purple, command green, cheat blue, note orange, task magenta. An
  unknown type takes an accent by the tag hash of its name.
- **Tag accents:** a tag's lowercased name, hashed as Raycast does (`acc × 31 + code point`, modulo 100 003), indexes
  the accents in the order blue, orange, green, purple, magenta, yellow, red. A tag keeps its accent in the list, the
  metadata card and the detail screen.
- **Pills:** the accent at 20% over `window`; the text is the accent, lifted toward `text` in 5% steps only as far as
  4.5:1 needs. Blue, green, orange and yellow keep their pure accent; purple, magenta and red lift slightly.
- **Validation** (`validation.json`): every text role on every surface meets WCAG 2.2 AA; every pill meets 4.5:1; the
  seven accents stay at least ΔE 15 apart (OKLab ×100) for normal vision and 8 under protan and deutan simulation.
  A passing check does not replace looking at the component on screen.
- **Light appearance:** GPUI Kit's default light theme, until a light palette is chosen (TODO).

## 3. Typography Rules

The system font (SF Pro) throughout; monospace (Menlo) only inside notes code. Sizes are GPUI Kit's text scale; they
copy the reference's relationships (the search field largest, title and description the same size, metadata and
chrome a step smaller) rather than pixel readings, which the screenshots cannot give reliably.

| Element                        | Size     | Weight             | Colour                          |
| ------------------------------ | -------- | ------------------ | ------------------------------- |
| Search field                   | 18 (lg)  | Regular            | `text`; placeholder `textFaint` |
| Row title                      | 14 (sm)  | Regular            | `text`                          |
| Row description                | 14 (sm)  | Regular            | `textMuted`                     |
| Tag pill                       | 12 (xs)  | Medium             | pill text                       |
| Section header (list, popover) | 12 (xs)  | Semibold           | `textMuted`                     |
| Metadata label / value         | 13       | Regular            | `textMuted` / `text`            |
| Notes body / headings          | 14 / 16+ | Regular / Semibold | `text`                          |
| Footer pill, action row        | 13       | Regular            | `textMuted` / `text`            |
| Keycap                         | 12 (xs)  | Medium             | `text` on `selection`           |

Commands and labels use Title Case ("Show Details", "Open in Browser", "All Entries"), as Raycast does: an
owner-approved departure from the GPUI Kit Design Guides' sentence case. Messages and notices stay sentences.

## 4. Component Stylings

- **Header:** no divider below it. The leading control (search glyph, or the back chevron on the detail screen) sits
  on the row-icon axis; the search text starts where row titles start. The filter button on the right carries a funnel
  icon and the current filter ("All Entries"), and shows its open state with a chevron.
- **List row:** a fixed icon column with the type tint; the title; the muted description on the same line; trailing
  accessories: at most three tag pills, then `+N`, then the link count with a link icon. The selection is an inset,
  rounded `selection` fill, never a full-width bar.
- **Tag pill:** filled (no outline), `#name` in pill text on the pill fill. **Tag image** (D4): a tag with a known
  image (`#linux` → penguin) shows the image instead, its name in the tooltip.
- **Split pane** (D3): the list takes about ⅓ of the width, the detail pane ⅔; one `divider` line between them.
- **Metadata card:** rows with the label left (`textMuted`) and the value right-aligned (`text`); alternate rows a
  shade lighter; Type and Tags as pills; Source with a file icon; URLs with an open-link ↗ icon.
- **Notes:** the description as a quote with a `red` bar; bookmark thumbnails above the metadata (split) or first
  (detail).
- **Detail screen:** the header shows only the back chevron; content starts with the notes, without a title block.
- **Footer:** two floating pills over the panel's bottom edge: the entry on the left; the primary action and Actions on
  the right, one keycap per key (`⌘` `K`, not `⌘K`).
- **Actions popover:** anchored above the footer's Actions button and opening upwards; the Return action first, then
  the primary action; each row shows its shortcut as keycaps; "Copy…" opens a submenu; the search field at the bottom.
- **Filter dropdown:** anchored under the filter button; a "Filters" section with the count and Clear All Filters while
  any is active; types and tags with ✓ / ○; it stays open while picking.

## 5. Layout Principles

- **Window** (D5): compact 860 × 520 points, and expanded to about 85% of the screen; ⌘⇧F toggles between them and
  the panel stays centred. The window is resizable in both.
- **Spacing:** the 4-point ramp of `layout.json` (`tight` 4, `compact` 8, `inset` 12, `standard` 16, `relaxed` 24,
  `section` 32). Native code maps points through GPUI's rem helpers so the layout scales with the interface.
- **Geometry** (`layout.json` `components`): header 56 high; rows 50; selection inset 8 with radius 12; panel radius
  28; popover radius 16. The comparison page refuses to render if the header control leaves the row-icon axis or the
  search text leaves the title edge.
- Group with whitespace; add a divider only at a real pane or section boundary.
- Equivalent content uses the same inset in the list, the split pane, the detail screen and popovers.

## 6. Depth & Elevation

Flat surfaces, no blur (D1). Popovers and footer pills sit on `raised` with a one-point edge (`divider` at 58% over
`raised`) and a soft two-layer shadow. `raised` shares `header`'s tone, so their separation comes from that edge, the
shadow and their placement against the control that opened them, not from a lighter fill: the owner's pick (variant E
on the comparison page) over a lighter popover tone.

## Adaptations

Where kb departs from Raycast, and why.

| Adaptation                                | Raycast                     | Reason                                                                    |
| ----------------------------------------- | --------------------------- | ------------------------------------------------------------------------- |
| Opaque surfaces, no blur                  | Translucent, blurred window | D1: the colours matter, not the material; blur costs GPU memory (tier 2)  |
| Popovers separated by edge and shadow     | Lighter translucent popover | Same-tone surfaces without blur need an edge to read as overlays          |
| Pill text lifted to 4.5:1                 | Pure accent text            | WCAG AA for 12-point text (PRODUCT.md)                                    |
| ⌘D toggles the split pane                 | → / ←                       | → and ← move the search cursor in GPUI's input                            |
| ⌘P opens the filter dropdown              | ⌘P                          | Same key, kept explicit                                                   |
| Two window sizes, toggled by ⌘⇧F          | One fixed size              | D5: kb is not bound by Raycast's window                                   |
| Title Case over the guide's sentence case | Title Case                  | Matches Raycast; owner-approved deviation from the GPUI Kit Design Guides |

## Evidence

The reference is eight local captures of Raycast's kb Search (list, split pane, detail, actions, filters, bookmark
media), mapped to components in `layout.json` `screenCoverage`. They show the private corpus, so they stay in the
gitignored `tools/reports/`; tracked files record only measurements and screen names. Raycast publishes no numeric
spacing for its extension UI: `layout.json` values are estimates from the captures, normalised to the ramp, and
[`raycast.json`](tools/design/raycast.json) holds the few colour and size readings `sample.py` can take reliably.

## Appendix: findings → rules

Each finding of the UI comparison report (local, `tools/reports/ui.md`) and the rule that settles it.

| Finding | Rule                                                        |
| ------- | ----------------------------------------------------------- |
| UI-01   | §1, §2 palette, §6 (no blur); panel radius §5               |
| UI-02   | §4 Header (no divider; funnel icon)                         |
| UI-03   | §4 List row (inset selection)                               |
| UI-04   | §3 (regular titles; muted description)                      |
| UI-05   | §2 Pills; §4 Tag pill                                       |
| UI-06   | §4 Tag image (D4)                                           |
| UI-07   | §4 Footer                                                   |
| UI-08   | §4 Split pane (D3)                                          |
| UI-09   | §4 Metadata card                                            |
| UI-10   | §4 Notes (red bar)                                          |
| UI-11   | §4 Detail screen (back chevron only)                        |
| UI-12   | §4 Detail screen (no title block)                           |
| UI-13   | §4 Actions popover (anchored); §6                           |
| UI-14   | §4 Actions popover (keycaps)                                |
| UI-15   | §4 Actions popover (order)                                  |
| UI-16   | §4 Actions popover (search at the bottom; Copy… submenu)    |
| UI-17   | §4 Filter dropdown (anchored; open state)                   |
| UI-18   | §4 Filter dropdown (stays open; ✓ / ○)                      |
| UI-19   | §4 Filter dropdown (Filters section)                        |
| UI-20   | §4 Notes (thumbnails)                                       |
| UI-21   | §4 List row (type icon; per-site icons with the tag images) |
| UI-22   | §4 Metadata card (↗ on URLs)                                |
| UI-23   | §4 Notes, Detail screen                                     |
