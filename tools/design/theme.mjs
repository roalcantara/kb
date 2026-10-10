// Writes crates/kb-app/assets/themes/kb.json, the app's GPUI Kit dark theme, from a palette of palettes.json: the
// chosen one, or the id given. Keys GPUI Kit's default dark theme does not define are refused; keys left out keep
// GPUI Kit's defaults.
// Usage: node tools/design/theme.mjs [palette-id]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mix, pill } from './color.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const out = resolve(root, 'crates/kb-app/assets/themes/kb.json')

const id = process.argv[2]
const palettes = JSON.parse(readFileSync(resolve(here, 'palettes.json'), 'utf8'))
const palette = palettes.find((p) => (id ? p.id === id : p.chosen))
if (!palette) throw new Error(id ? `No palette ${id} in palettes.json.` : 'No palette in palettes.json is chosen.')
const r = palette.roles

// Role → GPUI Kit key (DESIGN.md, Color Palette & Roles). GPUI Kit has no orange or purple: they wait for Plan 7.
const colors = {
  background: r.window,
  'list.background': r.window,
  'list.even.background': r.window,
  'list.head.background': r.window,
  'table.background': r.window,
  'title_bar.background': r.header,
  'list.active.background': r.selection,
  'accent.background': r.selection,
  'secondary.hover.background': r.selection,
  'secondary.active.background': r.selection,
  'popover.background': r.raised,
  'secondary.background': r.raised,
  'muted.background': r.raised,
  'description_list_label.background': r.raised,
  border: r.divider,
  'input.border': r.divider,
  'list.active.border': r.divider,
  'title_bar.border': r.divider,
  'window.border': r.divider,
  foreground: r.text,
  caret: r.text,
  'popover.foreground': r.text,
  'accent.foreground': r.text,
  'secondary.foreground': r.text,
  'muted.foreground': r.textMuted,
  'description_list_label.foreground': r.textMuted,
  'selection.background': mix(r.blue, r.window, 0.35),
  ring: r.blue,
  'link.foreground': r.blue
}
// Base hues and their `.light` tints, the tag-pill fill. Cyan has no role: it takes blue.
for (
  const [hue, role] of Object.entries({
    blue: 'blue',
    cyan: 'blue',
    green: 'green',
    red: 'red',
    yellow: 'yellow',
    magenta: 'magenta'
  })
) {
  colors[`base.${hue}`] = r[role]
  colors[`base.${hue}.light`] = pill(r, role).background
}

const defaults = JSON.parse(readFileSync(defaultThemePath(), 'utf8')).themes.find((t) => t.mode === 'dark').colors
const unknown = Object.keys(colors).filter((k) => !(k in defaults))
if (unknown.length) throw new Error(`Not GPUI Kit dark theme keys: ${unknown.join(', ')}`)

const theme = {
  name: 'kb',
  author: 'kb',
  themes: [{ name: 'kb Dark', mode: 'dark', colors: Object.fromEntries(Object.entries(colors).sort()) }]
}
writeFileSync(out, `${JSON.stringify(theme, null, 2)}\n`)
console.log(`wrote ${out.replace(`${root}/`, '')} from ${palette.id}`)

// GPUI Kit's default-theme.json in the Cargo registry, at the version Cargo.lock pins.
function defaultThemePath() {
  const lock = readFileSync(resolve(root, 'Cargo.lock'), 'utf8')
  const version = lock.match(/name = "gpui-component"\nversion = "([^"]+)"/)?.[1]
  const home = process.env.CARGO_HOME ?? resolve(process.env.HOME, '.cargo')
  const registry = resolve(home, 'registry', 'src')
  const index = readdirSync(registry).find((d) => existsSync(resolve(registry, d, `gpui-component-${version}`)))
  if (!index) throw new Error(`gpui-component ${version} is not in ${registry}: run cargo fetch.`)
  return resolve(registry, index, `gpui-component-${version}`, 'src/theme/default-theme.json')
}
