# UI polish from Raycast's design — design

- Status: approved
- Date: 2026-10-10

## Goal

kb looks and behaves like Raycast's kb Search: its palette, type scale, spacing, shapes, icons and component anatomy,
copied rather than reinvented, with adaptations only where kb differs on purpose. Two files carry the result for every
later contributor, human or agent: `PRODUCT.md` (what kb is for and how it should feel) and `DESIGN.md` (the design
system, with exact values). The findings are [tools/reports/ui.md](../../../tools/reports/ui.md) (UI-01…UI-23).

## Decisions

**D1. Colours: matched, soothing, opaque.** The palette starts from Raycast's, sampled from the screenshots; blur is not
needed. Because the owner is not a designer, the palette is chosen from a page that shows the sampled Raycast palette
beside six widely used dark palettes, each applied to the same kb mock-up and each checked by script: WCAG text
contrast for every text role on every surface, and colour-blind separation for the tag and type colours.

**D2. Typography is more than casing.** Raycast's sizes, weights and casing are copied: the system font (SF Pro, used by
both apps), regular-weight titles, muted subtitles, and Title Case for commands and labels. Title Case departs from the
GPUI Kit Design Guides' sentence case; DESIGN.md and `docs/experiment/compliance.md` record it.

**D3. Split pane as Raycast's:** the pane takes about two thirds of the width.

**D4. Tag images as Raycast's:** a tag with a matching image (`linux.svg`, …) is drawn as that image; the images come from
the Raycast extension's assets. Rows show at most three tags, then `+N`, then a link count.

**D5. Window size is not fixed.** ⌘⇧F toggles compact (today's 860×520) and expanded (about 85% of the screen,
centred), on every screen, and appears in the actions palette; the size holds for the session.

**D6. One source of values.** DESIGN.md states every token; the app reads colours from a GPUI Kit theme file
(`ThemeConfig` JSON, the framework's own mechanism) generated from the same values, and sizes from one Rust module.

**D7. Dark first.** The screenshots are dark; DESIGN.md defines the dark theme. Light keeps GPUI Kit's default until a
light set is designed (a `TODO.md` task).

**D8. Two plans.** Plan 6 (design foundation): measure, choose the palette with the owner, write PRODUCT.md and
DESIGN.md, apply the theme and typography. Plan 7 (components): the UI-xx findings in the report's backlog order, the
size toggle, and the parity rows A01 and S12 (marked Missing until fixed). After both, the measurement session of Plan 5
resumes. `TODO.md` tracks each.

**D9. The screenshots stay local.** They show the private corpus (entries, tags, file names) and the repository is
public, so `tools/reports/` is gitignored, as AGENTS.md requires for anything derived from the private corpus. What
goes into git is measured values only (colours, sizes) and mock-ups built from the committed sample corpus.

## Palette selection (Plan 6)

1. **Sample.** A script samples the eight Raycast screenshots at named points (window, header, selection, raised surfaces,
   dividers, text levels, tag pills, type icons) into a JSON file, with the point each value came from.
2. **Candidates.** The same roles are filled from six widely used dark palettes, each from its published source:
   Catppuccin (Mocha and Macchiato), Tokyo Night (Storm), GitHub Primer (Dark Dimmed), Nord and Radix Colors (Slate with
   Indigo). The sampled Raycast set is the seventh, and the baseline.
3. **Validate.** A dependency-free script checks each candidate: WCAG 2.2 contrast for primary and secondary text (4.5:1)
   and tertiary text and icons (3:1) on the window, selection and raised surfaces, and for tag text on its pill; OKLab
   ΔE between tag colours under normal, protan and deutan vision (≥ 8; 6–8 only with the `#tag` text beside the colour).
4. **Show.** A generated page renders each candidate as a kb mock-up (header, list with a selected row, tag pills, split
   metadata card, footer with keycaps) beside the Raycast screenshot, with each check's result. The owner opens it,
   compares, and picks one (or "closest to Raycast"); the plan stops there until then.
5. **Record.** DESIGN.md takes the chosen palette, its source and its check results.

## Scope

In: D1–D8; Plan 6 in full; Plan 7 written once DESIGN.md exists; `TODO.md` tasks for Plan 6, Plan 7, the measurement
session and the light theme.

Out: blur and translucency; a light palette; new behaviour beyond the size toggle; any change to the Raycast repository
(its assets are copied, never modified).
