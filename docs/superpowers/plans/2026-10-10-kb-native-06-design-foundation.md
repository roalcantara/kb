# kb native port — Plan 6: Design foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking. **Task 5 stops for the owner** to pick a palette: present the page
> and wait. Never commit anything under `tools/reports/` (private corpus, spec D9).

**Goal:** Measure Raycast's kb Search, let the owner choose a validated palette, write `PRODUCT.md` and `DESIGN.md`,
and apply the chosen colours and base typography to kb through a GPUI Kit theme file.

**Architecture:** A small design kit in `tools/design/` (sampler, candidate palettes, validator, page renderer, theme
generator, mise tasks) produces measured values and a comparison page; the chosen palette becomes
`crates/kb-app/assets/themes/kb.json`, loaded as kb's dark theme.

**Tech Stack:** Python + Pillow through `uv` (sampling only), Node (validator, page, theme; no dependencies), GPUI Kit
`ThemeConfig`, mise tasks.

**Spec:** [docs/superpowers/specs/2026-10-10-ui-polish-design.md](../specs/2026-10-10-ui-polish-design.md) (D1–D9).
**Findings:** `tools/reports/ui.md` and its screenshots (local only).

---

## File map

| Path                                                                                                                     | What                                                    | Task |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---- |
| `tools/design/sample.py`, `raycast.json`                                                                                 | colours and sizes measured from the Raycast screenshots | 2    |
| `tools/design/palettes.json`                                                                                             | the sampled set and six published palettes, by role     | 3    |
| `tools/design/validate.mjs`                                                                                              | WCAG contrast and colour-blind separation checks        | 4    |
| `tools/design/render.mjs`, `tools/design/tasks.toml`, `mise.toml`                                                        | comparison page; `mise run design:palettes`             | 5    |
| `PRODUCT.md`, `DESIGN.md`                                                                                                | the product and the design system                       | 6, 7 |
| `tools/design/theme.mjs`, `crates/kb-app/assets/themes/kb.json`, `crates/kb-app/src/lib.rs`, `crates/kb-app/tests/ui.rs` | kb's dark theme                                         | 8    |
| `docs/experiment/compliance.md`, `AGENTS.md`, `README.md`, `TODO.md`                                                     | Title Case deviation, pointers, tasks                   | 9    |

## Roles

Every palette fills the same roles; the page, the validator and the theme generator use these names.

| Role                                                      | Meaning                                                          | Raycast sample point (screen, display coords at 2000 px wide) |
| --------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `window`                                                  | the panel's surface, list area                                   | 1-list, (1500–1600, 500–560)                                  |
| `header`                                                  | the search header's surface                                      | 1-list, (900–1000, 30–60)                                     |
| `selection`                                               | the selected row                                                 | 1-list, (1250–1350, 205–255)                                  |
| `raised`                                                  | popovers, metadata rows, footer pills                            | 1-list footer pill, (520–535, 1165–1215)                      |
| `divider`                                                 | the split pane's divider                                         | 7-bookmark-split, (760–770, 400–600), brightest               |
| `text`                                                    | titles                                                           | 1-list, (150–235, 210–250), brightest                         |
| `textMuted`                                               | descriptions, labels                                             | 1-list, (265–780, 210–250), brightest                         |
| `textFaint`                                               | placeholder, hints                                               | 1-list, (150–700, 75–120), brightest                          |
| `blue` `green` `orange` `purple` `magenta` `yellow` `red` | Raycast's named colours (type tints, tag palette, in that order) | type icons and tag pill text, brightest                       |

---

### Task 1: Branch, and confirm the screenshots stay local

- [ ] `git switch main && git pull && git switch -c feat/design-foundation`.
- [ ] `.gitignore` already ignores `/tools/reports/` (committed with this plan): `git check-ignore -q tools/reports/ui.md`
      exits 0 and `git status --short tools/` lists nothing under `tools/reports/`. Nothing to commit.

### Task 2: Measure Raycast

- [ ] Create `tools/design/sample.py`: with Pillow, for each role above take the region's most common colour (surfaces)
      or brightest pixel (text, icons, `divider`), scaling display coordinates by `image.width / 2000`; for the accents,
      take the brightest pixel of each type icon and tag pill whose tint is known (commands green: 1-list type icon
      (68–115, 205–255); bookmark purple: 7-bookmark-split Type pill (1740–1900, 875–905); cheat blue: 2-split Type pill
      (1790–1910, 810–850); red, magenta, orange, yellow, blue from tag pills in 1-list, 5-actions and 6-filter: read
      each pill's text colour and name its hue). Also measure sizes: the bounding box of the contiguous region of a seed
      pixel's colour (±6 per channel) for the selected row, a tag pill, the footer pill, a keycap and the window, divided
      by 2 (Retina) into points. Write `tools/design/raycast.json`: `{ roles: {name: {hex, screen, box}}, sizes: {name: {w, h, radius_estimate}} }`.
- [ ] Run: `uv run -q --with pillow python -I tools/design/sample.py`. Expected: `raycast.json` with every role and
      size; `window` close to `#1E2532`, `selection` close to `#272D47`, `text` close to `#F6FCFD`.
- [ ] Note in the script's header that translucent surfaces (`raised`) vary with the wallpaper: the value is a reading,
      to be validated in Task 4 like any candidate.
- [ ] Commit `sample.py` and `raycast.json` (values only, no image): `feat(tools): Measure Raycast's palette and sizes`.

### Task 3: Candidate palettes

- [ ] Create `tools/design/palettes.json`: an array of seven `{ id, name, source, roles }`. `raycast` comes from
      `raycast.json`. The other six take each role from the palette's published values, citing the URL in `source`:

| id                     | Source                                                                     | window / header / selection / raised / divider                                              | text / textMuted / textFaint                 | accents (blue, green, orange, purple, magenta, yellow, red)                     |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| `catppuccin-mocha`     | https://catppuccin.com/palette (Mocha)                                     | base / mantle / surface0 / surface1 / surface0                                              | text / subtext0 / overlay1                   | blue, green, peach, mauve, pink, yellow, red                                    |
| `catppuccin-macchiato` | https://catppuccin.com/palette (Macchiato)                                 | base / mantle / surface0 / surface1 / surface0                                              | text / subtext0 / overlay1                   | blue, green, peach, mauve, pink, yellow, red                                    |
| `tokyo-night-storm`    | https://github.com/folke/tokyonight.nvim (`extras`, storm)                 | bg / bg_dark / bg_highlight / bg_float / fg_gutter                                          | fg / fg_dark / comment                       | blue, green, orange, purple, magenta, yellow, red                               |
| `github-dimmed`        | https://primer.style/foundations/color (dark dimmed)                       | canvas.default / canvas.inset / neutral.muted over canvas / canvas.overlay / border.default | fg.default / fg.muted / fg.subtle            | accent.fg, success.fg, severe.fg, done.fg, sponsors.fg, attention.fg, danger.fg |
| `nord`                 | https://www.nordtheme.com/docs/colors-and-palettes                         | nord0 / nord1 / nord2 / nord1 / nord3                                                       | nord6 / nord4 / nord3 brightened to pass 3:1 | nord8, nord14, nord12, nord15, nord15 lightened, nord13, nord11                 |
| `radix-slate-indigo`   | https://www.radix-ui.com/colors (Slate dark, Indigo dark, step 11 accents) | slate2 / slate1 / indigo4 / slate3 / slate6                                                 | slate12 / slate11 / slate10                  | blue11, grass11, orange11, violet11, plum11, amber11, red11                     |

Copy every hex from the source page as published; where the table says "brightened" or "lightened", record the
adjustment in a `notes` field.

- [ ] `node -e "JSON.parse(require('fs').readFileSync('tools/design/palettes.json'))"` exits 0; every palette has every
      role. Commit: `feat(tools): Add candidate palettes for kb`.

### Task 4: Validate

- [ ] Create `tools/design/validate.mjs`:

```js
// Checks each palette in tools/design/palettes.json and writes tools/design/validation.json:
// WCAG 2.2 contrast for every text role on every surface and for tag text on its pill, and OKLab ΔE (×100)
// between accents under normal, protan and deutan vision (Machado, Oliveira & Fernandes 2009, severity 1).
// Usage: node tools/design/validate.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('.', import.meta.url).pathname
const palettes = JSON.parse(readFileSync(`${dir}palettes.json`, 'utf8'))
const ACCENTS = ['blue', 'green', 'orange', 'purple', 'magenta', 'yellow', 'red']
const PILL_ALPHA = 0.2 // a tag pill is its accent at 20% over the window, as Raycast draws them

const rgb = h => {
  const n = Number.parseInt(h.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = c => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const mix = (fg, bg, a) => toHex(rgb(fg).map((v, i) => v * a + rgb(bg)[i] * (1 - a)))
const lin = v => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = h => {
  const [r, g, b] = rgb(h).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const CVD = {
  normal: null,
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]]
}
const simulate = (h, m) => {
  const c = rgb(h).map(lin)
  return m ? m.map(r => Math.min(1, Math.max(0, r[0] * c[0] + r[1] * c[1] + r[2] * c[2]))) : c
}
const oklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}
const deltaE = (a, b, m) => {
  const [p, q] = [oklab(simulate(a, m)), oklab(simulate(b, m))]
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

const check = (name, value, pass, warn) => ({
  name,
  value: Math.round(value * 100) / 100,
  status: value >= pass ? 'pass' : warn !== undefined && value >= warn ? 'warn' : 'fail'
})

const results = palettes.map(({ id, roles: r }) => {
  const checks = []
  for (const surface of ['window', 'selection', 'raised', 'header']) {
    checks.push(check(`text on ${surface}`, contrast(r.text, r[surface]), 4.5))
    checks.push(check(`textMuted on ${surface}`, contrast(r.textMuted, r[surface]), 4.5))
  }
  checks.push(check('textFaint on window', contrast(r.textFaint, r.window), 3))
  checks.push(check('divider on window', contrast(r.divider, r.window), 1.2))
  for (const a of ACCENTS) {
    checks.push(check(`#${a} on its pill`, contrast(r[a], mix(r[a], r.window, PILL_ALPHA)), 4.5, 3))
  }
  for (const [vision, m] of Object.entries(CVD)) {
    let worst = { value: Infinity }
    for (let i = 0; i < ACCENTS.length; i++) {
      for (let j = i + 1; j < ACCENTS.length; j++) {
        const value = deltaE(r[ACCENTS[i]], r[ACCENTS[j]], m)
        if (value < worst.value) worst = { value, pair: `${ACCENTS[i]}/${ACCENTS[j]}` }
      }
    }
    // Tags always carry their #name, so 6-8 under colour-blind vision is a warning, not a failure.
    const c = vision === 'normal'
      ? check('accents apart (normal)', worst.value, 15)
      : check(`accents apart (${vision})`, worst.value, 8, 6)
    checks.push({ ...c, pair: worst.pair })
  }
  const failed = checks.filter(c => c.status === 'fail').length
  return { id, failed, warned: checks.filter(c => c.status === 'warn').length, checks }
})

writeFileSync(`${dir}validation.json`, `${JSON.stringify(results, null, 2)}\n`)
for (const { id, failed, warned } of results) {
  console.log(`${id.padEnd(22)} ${failed ? `${failed} fail` : 'pass'}${warned ? `, ${warned} warn` : ''}`)
}
```

- [ ] Run: `node tools/design/validate.mjs`. Expected: one line per palette, and `validation.json`. A palette that fails
      is still shown in Task 5, with its failures listed: the owner sees why.
- [ ] Commit `validate.mjs` and `validation.json`: `feat(tools): Validate the candidate palettes`.

### Task 5: Comparison page — stop for the owner

- [ ] Create `tools/design/render.mjs`: reads `palettes.json` and `validation.json` and writes `tmp/design/palettes.html`
      (gitignored `tmp/`), one card per palette in order, each with:
  - the palette's name, source link and a pass/warn/fail badge with the failing checks listed;
  - a mock-up in that palette, built in HTML/CSS: header (search text in `text`, placeholder in `textFaint`, a filter
    button "All Entries ⌄"), four list rows (type icon in its accent, regular-weight title in `text`, description in
    `textMuted`, two `#tag` pills at 20% tint), the second row selected (`selection`, rounded, inset 8px), a split
    metadata card (`raised` rows: Type pill, Tags pills, Source), and a footer with two `raised` pills and `⌘` `K`
    keycaps. Row content comes from the committed sample corpus (`crates/kb-domain/tests/fixtures/sample/*.yml`), never
    from the private one;
  - swatches of every role with its hex.
    At the top, if `tools/reports/1-list-ray.png` and `2-list-split-ray.png` exist locally, embed them by relative path
    (they stay out of git) as the reference.
- [ ] Create `tools/design/tasks.toml` and include it from `mise.toml`'s `[task_config] includes`:

```toml
# The design kit (tools/design): measure Raycast, validate candidate palettes, render the comparison page.

["design:sample"]
description = "Measure colours and sizes from the local Raycast screenshots (tools/reports) into tools/design/raycast.json"
run = "uv run -q --with pillow python -I tools/design/sample.py"

["design:palettes"]
description = "Validate the candidate palettes and open the comparison page (tmp/design/palettes.html)"
run = "node tools/design/validate.mjs && node tools/design/render.mjs && open tmp/design/palettes.html"
```

- [ ] Run: `mise run design:palettes`. Expected: the page opens with seven cards. Commit the kit:
      `feat(tools): Render the palette comparison page`.
- [ ] **Stop.** Tell the owner: open `tmp/design/palettes.html` (or run `mise run design:palettes`), compare the cards
      with the Raycast reference, and pick one by id — or ask for a blend, such as "Raycast's surfaces with Catppuccin's
      accents", which you then add as an eighth candidate, validate and re-render. Continue only with the owner's pick.

### Task 6: PRODUCT.md

- [ ] Write `PRODUCT.md` at the root, in the PRODUCT.md standard's canonical sections (https://product.md):
  - `# kb` and a one-line description: a native macOS panel for searching a personal YAML knowledge base, by keyboard.
  - **Register:** product.
  - **Users:** the owner, a keyboard-first developer who keeps commands, bookmarks, cheats, notes and tasks in YAML; and
    the coding agents that work on kb.
  - **Problem:** Raycast's extension limits (size, runtime, memory) and its 2–3 step startup cost for a tool opened
    dozens of times a day.
  - **Product Purpose:** find and use an entry in two keystrokes after ⌥K; success is the experiment's criteria
    (`docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md`, "Report").
  - **Brand Personality / Tone:** quiet, fast, native; looks and speaks like Raycast (Title Case labels, short verbs).
  - **Anti-references:** web pages in a window; centred modal dialogs; dense dashboards; anything slower than typing.
  - **Design Principles:** 1. keyboard first, every action has a visible shortcut; 2. copy Raycast's design, adapt
    only on purpose, and record each adaptation in DESIGN.md; 3. overlays open where they are invoked; 4. never block
    typing; 5. the window is as large as the task needs (compact and expanded).
  - **Accessibility & Inclusion:** WCAG 2.2 AA contrast for text; nothing told by colour alone; every control named for
    assistive technology (`docs/experiment/compliance.md`).
  - **Offer:** free, personal use; no pricing.
  - **Boundaries:** reads source files, never writes them; one user; macOS first.
  - **Stack:** links to `AGENTS.md`, `CONTEXT.md`, `DESIGN.md` — no duplication.
- [ ] `dprint fmt PRODUCT.md && hk check --all`. Commit: `docs: Add PRODUCT.md`.

### Task 7: DESIGN.md

- [ ] Write `DESIGN.md` at the root (sections as the design-md format: atmosphere, palette, typography, components,
      layout, plus elevation and adaptations):
  1. **Visual Theme & Atmosphere** — Raycast's: a calm, dark navy launcher; quiet surfaces; colour reserved for meaning
     (types, tags, state).
  2. **Color Palette & Roles** — the owner's pick: each role with a descriptive name, hex and job (the Roles table
     above), the seven accents and their jobs (type tints: bookmark purple, command green, cheat blue, note orange,
     task magenta; tags: hashed over the seven in the order blue, orange, green, purple, magenta, yellow, red, as the
     Raycast extension's `accessories.ts`), the pill rule (accent text on 20% accent over the window), the source, and
     the Task 4 results.
  3. **Typography Rules** — the system font (SF Pro); sizes and weights per element from `raycast.json` (search field,
     row title regular, row description muted, metadata label/value, section header, keycap); Title Case for commands
     and labels (deviation from the GPUI Kit Design Guides, owner-approved).
  4. **Component Stylings** — header (no divider; filter button with funnel icon), list row (icon, title, description,
     max three tag pills then `+N`, link count; inset rounded selection), tag pill (filled), tag image (D4), split pane
     (pane ≈ ⅔, D3), metadata card (rows: label left, value right, pills), detail screen (back chevron only; notes
     first), footer (two floating pills; one keycap per key), actions popover (anchored above the Actions button;
     search at the bottom; shortcuts as keycaps), filter dropdown (under the filter button; stays open; ✓ / ○).
  5. **Layout Principles** — window compact 860×520 and expanded ≈ 85% of the screen (⌘⇧F, D5); gutters, row height,
     radii from `raycast.json`.
  6. **Depth & Elevation** — flat surfaces separated by tone, no blur (D1); popovers one tone lighter with a 1px
     `divider` border.
  7. **Adaptations** — every place kb departs from Raycast and why: no blur; Title Case kept over the guide;
     ⌘D for the split pane (→/← move the search cursor in GPUI); ⌘P for filters; resizable window.
- [ ] Each UI-xx finding of `tools/reports/ui.md` maps to a DESIGN.md rule; list the mapping in an appendix table
      (finding id → section), without copying the screenshots' content.
- [ ] `dprint fmt DESIGN.md && hk check --all`. Commit: `docs: Add DESIGN.md`.

### Task 8: Apply the palette and base typography

- [ ] Create `tools/design/theme.mjs`: `node tools/design/theme.mjs <id>` writes `crates/kb-app/assets/themes/kb.json`,
      a GPUI Kit theme file (`{ name, author, themes: [{ name: "kb Dark", mode: "dark", colors: {…} }] }`) mapping roles
      to GPUI Kit keys: `background`, `list.background`, `title_bar.background` ← `window` / `header`;
      `list.active.background`, `accent.background` ← `selection`; `popover.background`, `secondary.background`,
      `muted.background` ← `raised`; `border`, `input.border`, `list.active.border` ← `divider`; `foreground`,
      `popover.foreground`, `accent.foreground` ← `text`; `muted.foreground` ← `textMuted`; `base.blue`, `base.green`,
      `base.red`, `base.yellow`, `base.magenta`, `base.cyan` ← the accents (cyan ← blue), and each `base.*.light`
      ← the accent at 20% over the window. Check every key against GPUI Kit's `default-theme.json` dark entry and
      keep only keys it defines.
- [ ] Write the failing UI test in `crates/kb-app/tests/ui.rs`: with the window appearance dark, `cx.theme().background`
      equals the chosen `window` hex.
- [ ] In `crates/kb-app/src/lib.rs` `init_theme`: parse `include_str!("../assets/themes/kb.json")` into GPUI Kit's
      `ThemeSet`, take its dark theme, set it as the theme's `dark_theme` (`Theme::global_mut(cx)`), then
      `Theme::sync_system_appearance(None, cx)` as today; on a light appearance GPUI Kit's default light theme stays.
      Row titles become regular weight (DESIGN.md typography) in `entry_list::render_row`.
- [ ] Run the UI test, then `mise run gate`, then `mise run show` and compare with the Raycast reference. Commit:
      `feat(app): Apply DESIGN.md's palette and base typography`.

### Task 9: Docs, TODO, hand-off

- [ ] `docs/experiment/compliance.md`: the sentence-case item becomes "Copy follows Raycast's Title Case (DESIGN.md,
      Adaptations; owner-approved deviation from the GPUI Kit Design Guides)", still checked.
- [ ] `AGENTS.md` repository map: `PRODUCT.md` and `DESIGN.md` — read DESIGN.md before any UI change. README "Project
      Structure": both files and `tools/design/`.
- [ ] `TODO.md` (todo CLI): mark Plan 6 done; keep Plan 7 (components), the measurement session and the light theme
      pending.
- [ ] Self-review: `git diff main --stat`; `git ls-files tools/reports` is empty. Push `feat/design-foundation`; do not
      open a pull request. Report: the owner's pick, the validation results, commits, and anything that deviated.
