// Checks each palette in tools/design/palettes.json and writes tools/design/validation.json:
// WCAG 2.2 contrast for every text role on every surface and for tag text on its pill, and OKLab ΔE (×100)
// between accents under normal, protan and deutan vision (Machado, Oliveira & Fernandes 2009, severity 1).
// Usage: node tools/design/validate.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('.', import.meta.url).pathname
const palettes = JSON.parse(readFileSync(`${dir}palettes.json`, 'utf8'))

const ACCENTS = ['blue', 'green', 'orange', 'purple', 'magenta', 'yellow', 'red']
const PILL_ALPHA = 0.2 // a tag pill is its accent at 20% over the window, as Raycast draws them

const rgb = (h) => {
  const n = Number.parseInt(h.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const mix = (fg, bg, a) => toHex(rgb(fg).map((v, i) => v * a + rgb(bg)[i] * (1 - a)))
const lin = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = (h) => {
  const [r, g, b] = rgb(h).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const CVD = {
  normal: null,
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998]
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881]
  ]
}
const simulate = (h, m) => {
  const c = rgb(h).map(lin)
  return m ? m.map((r) => Math.min(1, Math.max(0, r[0] * c[0] + r[1] * c[1] + r[2] * c[2]))) : c
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
  const failed = checks.filter((c) => c.status === 'fail').length
  return { id, failed, warned: checks.filter((c) => c.status === 'warn').length, checks }
})

writeFileSync(`${dir}validation.json`, `${JSON.stringify(results, null, 2)}\n`)
for (const { id, failed, warned } of results) {
  console.log(`${id.padEnd(22)} ${failed ? `${failed} fail` : 'pass'}${warned ? `, ${warned} warn` : ''}`)
}
