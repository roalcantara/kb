# Design system

## Visual theme

kb is a quiet, keyboard-first macOS launcher. Its visual reference is the Raycast kb Search extension, not a generic
dashboard. Keep the main panel calm and flat; use small surface changes, selection, and spacing to establish hierarchy
before adding borders or card backgrounds. Colour communicates types, tags, and state.

## Reference and evidence

Raycast is the single reference system for the component anatomy, layout, and spacing decisions in this document. The
specification is based on the eight local Raycast captures named in [`tools/design/layout.json`](tools/design/layout.json),
covering list, split list, detail, actions, filters, and bookmark media. They are private-corpus screenshots and stay in
gitignored `tools/reports/`; do not copy them into documentation, commits, or generated assets.

Raycast does not publish numeric spacing values for its extension UI primitives. Values in `layout.json` are therefore
measured estimates from those captures, normalized into a 4-point spacing ramp for a coherent implementation. They are
not claims about Raycast's internal constants. When a capture reveals a specific relationship (for example, search text
aligned with row titles), preserve that relationship even when the nearest ramp value is imperfect.

## Palette

The selected palette is **Tokyo Night Storm Flat Separated**, a manually tuned Tokyo Night Storm variant:

| Role        | Value     | Use                                                     |
| ----------- | --------- | ------------------------------------------------------- |
| `window`    | `#23273A` | Main panel and list surface                             |
| `header`    | `#24293E` | Header and popup surface                                |
| `selection` | `#2A3047` | Selected row or selected popup item                     |
| `raised`    | `#24293E` | Raised controls where an elevated surface is meaningful |
| `divider`   | `#353D5A` | Structural boundaries only                              |
| `text`      | `#CBD4FF` | Primary content                                         |
| `textMuted` | `#B2BADB` | Descriptions and secondary labels                       |
| `textFaint` | `#7A86B6` | Placeholders and tertiary hints                         |
| `blue`      | `#70B9F4` | Cheat type and blue tags                                |
| `green`     | `#30E1A5` | Command type and green tags                             |
| `orange`    | `#F5A95D` | Note type and orange tags                               |
| `purple`    | `#A362F2` | Bookmark type and purple tags                           |
| `magenta`   | `#E927AB` | Task type and magenta tags                              |
| `yellow`    | `#D9E753` | Yellow tags                                             |
| `red`       | `#E04F50` | Red tags                                                |

The full set and its validation live in [`tools/design/palettes.json`](tools/design/palettes.json) and
[`tools/design/validation.json`](tools/design/validation.json). Current automated result: zero failed checks; three
warnings for purple, magenta, and red tag-text contrast. Do not treat a passing palette check as a substitute for
checking the actual component on screen.

Surface mapping is intentional: the main list stays opaque and flat; popovers use `header` and are separated by their
anchored placement, subtle border/shadow, and restrained dimming of the underlying panel. Do not tint the whole main
header as an arbitrary extra card. Avoid blur and strong, high-contrast outlines.

## Typography

Use the system UI font. Keep primary result titles regular-weight, descriptions muted, and labels concise. Commands and
labels use Raycast-style Title Case, an owner-approved deviation from the GPUI Kit Design Guides' sentence case. Use
consistent type styles per semantic role across screens rather than scaling typography to fit an individual mock-up.

## Layout and spacing

[`tools/design/layout.json`](tools/design/layout.json) is the shared source of layout tokens and alignment rules. Use
logical points and the named ramp (`tight` 4, `compact` 8, `inset` 12, `standard` 16, `relaxed` 24, `section` 32) rather
than inventing nearby values per screen. The browser renderer expresses these tokens in CSS points; native GPUI code
must map them through the framework's rem-based spacing helpers so they scale with the interface. One-point hairlines
are reserved for boundaries that convey actual structure.

Key cross-screen invariants:

- Search text and result titles share a leading edge. Header controls and row icons share a vertical center line.
- Rows reserve a stable icon column. A different icon shape must not move the title, description, or tags.
- A result title and its description align to each other. Tags are trailing accessories and never determine the text
  column.
- Use the same content inset for equivalent content in list, split detail, and detail view. Any intentional exception is
  named in the component tokens.
- Popovers align to the control that opened them; their internal content uses the same spacing ramp as the main panel.
- Use whitespace to group content. Add a divider only at a real pane or section boundary, not between every row.
- Keep selection inset from the list edges with a soft radius. Keep tag pills compact and less rounded than full capsule
  controls.

The token set covers every captured screen:

| Screen                                 | Shared parts exercised                                |
| -------------------------------------- | ----------------------------------------------------- |
| List                                   | Panel, header, results, tags, footer                  |
| List with split pane; selection moving | Split ratio, result rows, tags, metadata              |
| Detail                                 | Panel, back-only header, detail content, footer       |
| Actions                                | Anchored popover, action rows, footer                 |
| Filters                                | Anchored popover, filter control, result rows, footer |
| Bookmark split and detail              | Split ratio, metadata, media and detail content       |

The split layout gives about one-third of the width to results and two-thirds to detail. Detail content starts with notes;
media follows the reference's content-first placement. Actions open above their footer anchor, and filters open below the
filter control. Those are component behaviors, not exceptions to the shared spacing system.

## Components and elevation

- **Header:** one search field; the back control is centered on the row-icon axis; no decorative bottom divider. Detail
  view shows only the back control.
- **Result row:** stable icon column, regular title, muted description, trailing tags; selected row uses an inset
  background rather than a full-width stripe.
- **Tags:** subdued tinted fill, modest corner radius, compact internal padding. Preserve the leading `#` label so
  meaning is not conveyed by hue alone.
- **Footer:** two floating controls with distinct keycaps for each key.
- **Metadata:** grouped rows with labels and values aligned consistently; tags and type use their semantic accents.
- **Popovers:** same-tone header and body as specified by the chosen Variant E treatment. Separation comes from anchor
  placement, a quiet edge, and shadow—not a dramatically different fill or thick outline.
- **Split pane:** a single quiet separator marks the actual pane boundary.

## Adaptations from Raycast

| Adaptation                                  | Reason                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Opaque surfaces instead of blur             | Simpler, predictable rendering; keeps the experiment focused on palette and layout |
| Variant E popup surface                     | Makes popup vs. panel legible without a radically different color                  |
| Tokyo Night Storm tuned accents             | Better tag/type distinction while retaining the selected dark palette              |
| Title Case labels                           | Owner-approved match to Raycast                                                    |
| ⌘D split-pane toggle and ⌘P filter shortcut | Existing kb interaction choices                                                    |
| Resizable window                            | kb-specific behavior                                                               |

## Screenshot coverage and maintenance

The capture-to-component map is recorded in `tools/design/layout.json`. Before changing shared spacing or component
geometry, inspect all relevant references in `tools/reports/`, not just the list screenshot. The captures stay local;
record only numeric measurements and screen/component names in tracked files. Update the shared tokens first, then update
every consumer in the same change so list, split, detail, action, and filter screens remain consistent.
