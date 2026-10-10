// Colour arithmetic shared by validate.mjs, render.mjs and theme.mjs, so the three agree on every derived colour.
export const ACCENTS = ['blue', 'green', 'orange', 'purple', 'magenta', 'yellow', 'red']
// A tag pill is its accent at 20% over the window; its text is the accent, lifted toward `text` in 5% steps only as far
// as WCAG AA (4.5:1) needs (DESIGN.md, Tags).
export const PILL_ALPHA = 0.2
export const AA = 4.5

export const rgb = (h) => {
  const n = Number.parseInt(h.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const toHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`
export const mix = (fg, bg, a) => toHex(rgb(fg).map((v, i) => v * a + rgb(bg)[i] * (1 - a)))

export const lin = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
export const luminance = (h) => {
  const [r, g, b] = rgb(h).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// Type tints and the tag hash, as the Raycast extension's accessories.ts: a tag keeps one accent everywhere.
export const TYPE_ACCENTS = { bookmark: 'purple', command: 'green', cheat: 'blue', note: 'orange', task: 'magenta' }
export const TAG_ORDER = ['blue', 'orange', 'green', 'purple', 'magenta', 'yellow', 'red']
export const MAX_TAGS = 3
const hash = (value) => [...value].reduce((acc, char) => (acc * 31 + char.codePointAt(0)) % 100_003, 0)
export const tagAccent = (tag) => TAG_ORDER[hash(tag.toLowerCase()) % TAG_ORDER.length]
// `type` is the type key: the entry type singular and lowercased (`commands` → `command`).
export const typeAccent = (type) => TYPE_ACCENTS[type] ?? TAG_ORDER[hash(type) % TAG_ORDER.length]

export const pill = (roles, accent) => {
  const background = mix(roles[accent], roles.window, PILL_ALPHA)
  let text = roles[accent]
  for (let lift = 0.05; contrast(text, background) < AA && lift <= 1; lift += 0.05) {
    text = mix(roles.text, roles[accent], lift)
  }
  return { background, text }
}
