// Renders tmp/design/palettes.html: every palette of palettes.json (the chosen one first) drawn as kb's list with its
// actions and filter popovers, and as the split pane with its metadata card and footer, from the sample corpus's
// goldens. Spacing comes from layout.json, derived colours and tag rules from color.mjs, results from validation.json.
// Usage: node tools/design/render.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAX_TAGS, mix, pill, tagAccent, typeAccent } from './color.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const palettes = JSON.parse(read('tools/design/palettes.json')).sort((a, b) => Number(!!b.chosen) - Number(!!a.chosen))
const layout = JSON.parse(read('tools/design/layout.json'))
const validation = new Map(JSON.parse(read('tools/design/validation.json')).map((v) => [v.id, v]))
const htmlOut = resolve(root, 'tmp', 'design', 'palettes.html')

const escape = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
// Only http(s) sources become links; anything else is shown as text.
const link = (url) => (/^https?:\/\//.test(url) ? `<a href="${escape(url)}">${escape(url)}</a>` : escape(url))

// The search view's geometry: the header's leading control sits on the row-icon axis, and the search text starts
// where result titles do (DESIGN.md, Layout).
const { panel, header, resultRow, tag, footer, popover, actionItem, filterControl, splitPane, metadata } =
  layout.components
const rowContentStart = resultRow.selectionInsetX + resultRow.horizontalInset
if (header.horizontalInset !== rowContentStart) {
  throw new Error(`Header control and row icons are off-axis: ${header.horizontalInset} != ${rowContentStart} points.`)
}
if (header.controlGap !== resultRow.iconToTitleGap) {
  throw new Error(
    `Search text and result titles are misaligned: gaps ${header.controlGap} != ${resultRow.iconToTitleGap}.`
  )
}

// Rows in the empty query's order, from the TypeScript engine's goldens.
const golden = 'crates/kb-domain/tests/fixtures/sample-goldens'
const rows = new Map(read(`${golden}/rows.jsonl`).trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.id, r]))
// An entry's tags from its raw YAML: `tag: x`, `tags: [x, y]` or a block list under `tags:`.
const tagsOf = (yaml) => {
  const [, value = '', block = ''] = yaml.match(/^tags?:[ \t]*(.*)\n((?:[ \t]+- .*\n?)*)/m) ?? []
  const list = value.startsWith('[')
    ? value.slice(1, -1).split(',')
    : value
    ? [value]
    : block.split('\n').map((l) => l.replace(/^\s*- /, ''))
  return list.map((t) => t.trim().toLowerCase()).filter(Boolean)
}
const entries = JSON.parse(read(`${golden}/queries.json`))
  .find((q) => q.id === 'q01-empty')
  .results.map(({ id }) => rows.get(id))
  .map((r) => ({
    title: r.title,
    description: r.description,
    typeKey: r.type.toLowerCase().replace(/s$/, ''),
    type: r.type,
    tags: tagsOf(r.raw_yaml),
    links: JSON.parse(r.links_json || '[]').length,
    source: r.source_rel_path
  }))
  .slice(0, 7)
const selected = entries.findIndex((e) => e.tags.length && e.links)

const references = [1, 2, 3, 4, 5, 6, 7, 8]
  .map((n) =>
    ['list', 'list-split', 'list-split-down', 'detail', 'actions', 'filter', 'bookmark-split', 'bookmark-detail'][n - 1]
  )
  .map((name, i) => `tools/reports/${i + 1}-${name}-ray.png`)
  .filter((rel) => existsSync(resolve(root, rel)))

const roleOrder = ['window', 'header', 'selection', 'raised', 'divider', 'text', 'textMuted', 'textFaint']

const pills = (roles, tags) => {
  const shown = tags.slice(0, MAX_TAGS).map((t) => {
    const { background, text } = pill(roles, tagAccent(t))
    return `<span class="pill" style="background:${background};color:${text}">#${escape(t)}</span>`
  })
  const more = tags.length - MAX_TAGS
  return shown.join('') + (more > 0 ? `<span class="more">+${more}</span>` : '')
}
const listRow = (roles, e, i, compact) =>
  `<div class="row ${i === selected ? 'sel' : ''}">
    <span class="icon" style="background:${roles[typeAccent(e.typeKey)]}"></span>
    <div class="text"><div class="title">${escape(e.title)}</div>${
    compact ? '' : `<div class="sub">${escape(e.description)}</div>`
  }</div>
    <div class="tags">${
    compact ? '' : pills(roles, e.tags) + (e.links ? `<span class="more">🔗 ${e.links}</span>` : '')
  }</div>
  </div>`
const keycaps = (keys) => keys.map((k) => `<kbd>${escape(k)}</kbd>`).join('')
const footerBar = (e) =>
  `<div class="footer"><span class="fpill">${escape(e.title)}</span><span class="fpill">Open ${
    keycaps(['↵'])
  }</span><span class="fpill">Actions ${keycaps(['⌘', 'K'])}</span></div>`
const headerBar = (filter) =>
  `<div class="bar"><div class="query"><span class="lead">⌕</span><span class="placeholder">Search Knowledge Base…</span></div>${
    filter ? '<div class="affordance">⏷ All Entries ⌄</div>' : ''
  }</div>`

const listScene = (roles) =>
  `<div class="scene"><div class="panel">${headerBar(true)}<div class="list-body">${
    entries.map((e, i) => listRow(roles, e, i, false)).join('')
  }</div>${footerBar(entries[selected])}</div>
    <div class="popup actions"><div class="popup-body">
      <div class="action sel"><span>Show Details</span>${keycaps(['↵'])}</div>
      <div class="action"><span>Open in Browser</span>${keycaps(['⌘', '↵'])}</div>
      <div class="action"><span>Copy…</span><span class="keys">›</span></div>
      <div class="action"><span>Open Source File</span>${keycaps(['⌘', 'O'])}</div>
    </div><div class="popup-bar">Search for actions…</div></div>
    <div class="popup filter"><div class="popup-body">
      <div class="option"><span>✓</span>Bookmarks</div><div class="option"><span>○</span>Commands</div>
      <div class="option"><span>✓</span>#docs</div><div class="option"><span>○</span>#git</div>
    </div></div>
  </div>`

const splitScene = (roles) => {
  const e = entries[selected]
  const type = pill(roles, typeAccent(e.typeKey))
  return `<div class="scene"><div class="panel">${headerBar(true)}<div class="split">
    <div class="list-body">${entries.map((x, i) => listRow(roles, x, i, true)).join('')}</div>
    <div class="detail">
      <blockquote style="border-color:${roles.red}">${escape(e.description)}</blockquote>
      <div class="card">
        <div class="meta"><span>Type</span><span class="pill" style="background:${type.background};color:${type.text}">${
    escape(e.type)
  }</span></div>
        <div class="meta"><span>Tags</span><span>${pills(roles, e.tags)}</span></div>
        <div class="meta"><span>Links</span><span>${e.links}</span></div>
        <div class="meta"><span>Source</span><span>📄 ${escape(e.source)}</span></div>
      </div>
    </div>
  </div>${footerBar(e)}</div></div>`
}

const vars = (roles) =>
  Object.entries({
    ...Object.fromEntries(roleOrder.map((r) => [r, roles[r]])),
    popupBorder: mix(roles.divider, roles.raised, 0.58),
    zebra: mix(roles.text, roles.raised, 0.03)
  })
    .map(([k, v]) => `--${k}:${v}`)
    .join(';')

const results = (id) => {
  const summary = validation.get(id)
  if (!summary) return '<p class="hint">Not validated: run node tools/design/validate.mjs.</p>'
  const by = (status) => summary.checks.filter((c) => c.status === status)
  const items = (checks) =>
    checks.length
      ? checks.map((c) => `<li>${escape(c.name)} (${c.value})${c.pair ? ` [${escape(c.pair)}]` : ''}</li>`).join('')
      : '<li>none</li>'
  const badge = summary.failed ? 'fail' : summary.warned ? 'warn' : 'pass'
  return `<span class="badge ${badge}">${badge}</span>
    <div class="status-grid"><div><h3>Fails</h3><ul>${items(by('fail'))}</ul></div><div><h3>Warns</h3><ul>${
    items(by('warn'))
  }</ul></div></div>`
}

const section = (p) =>
  `<section class="palette" style="${vars(p.roles)}">
    <div class="summary"><h2>${escape(p.name)}${p.chosen ? ' <small>chosen</small>' : ''}</h2>
      <p class="hint">${link(p.source)}${(p.notes ?? []).map((n) => ` · ${escape(n)}`).join('')}</p>${
    results(p.id)
  }</div>
    <div class="scenes">${listScene(p.roles)}${splitScene(p.roles)}</div>
    <div class="swatches">${
    Object.entries(p.roles)
      .map(([role, hex]) =>
        `<div class="swatch"><i style="background:${hex}"></i><b>${role}</b><span>${hex}</span></div>`
      )
      .join('')
  }</div>
  </section>`

// Layout values are logical points; a macOS point is one CSS pixel.
const pt = (v) => `${v}px`
const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>kb palettes</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; padding: 24px; background: #0f1115; color: #e9edf3; font: 14px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
    .wrap { max-width: 1400px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 0; font-size: 18px; } h2 small { font-size: 12px; color: #9ef3bb; }
    .hint { margin: 4px 0; color: #9ba4b2; font-size: 12px; } a { color: #9fc4ff; }
    .refs { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin: 12px 0 24px; }
    .refs img { width: 100%; border-radius: 8px; border: 1px solid #2d3440; }
    .palette { margin: 0 0 40px; }
    .summary { background: #171b22; border: 1px solid #2a303b; border-radius: 14px; padding: 12px; margin: 0 0 12px; }
    .badge { border-radius: 999px; padding: 2px 9px; font-size: 12px; font-weight: 600; text-transform: capitalize; }
    .badge.pass { background: #1c3f2e; color: #9ef3bb; } .badge.warn { background: #46360f; color: #f1ce74; } .badge.fail { background: #472026; color: #f1a9b3; }
    .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; font-size: 12px; }
    .status-grid h3 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase; color: #9fb0c7; } .status-grid ul { margin: 0; padding-left: 18px; }
    .scenes { display: grid; grid-template-columns: repeat(auto-fit, minmax(560px, 1fr)); gap: 12px; }

    .scene { position: relative; padding: ${pt(panel.outerInset)}; border-radius: 12px; background: #111; }
    .panel { border: 1px solid color-mix(in oklab, var(--divider) 60%, transparent); border-radius: ${
  pt(panel.cornerRadius)
}; overflow: hidden; background: var(--window); color: var(--text); font-size: 13px; }
    .bar { height: ${pt(header.height)}; padding: 0 ${
  pt(header.horizontalInset)
}; display: flex; justify-content: space-between; align-items: center; }
    .query { display: flex; align-items: center; gap: ${pt(header.controlGap)}; }
    .lead { width: ${pt(resultRow.iconColumn)}; text-align: center; color: var(--textMuted); font-size: 18px; }
    .placeholder { color: var(--textFaint); font-size: 16px; }
    .affordance { color: var(--textMuted); font-size: 12px; }
    .list-body { padding: ${pt(layout.spacing.values.compact)} 0; }
    .row { display: grid; grid-template-columns: ${pt(resultRow.iconColumn)} 1fr auto; column-gap: ${
  pt(resultRow.iconToTitleGap)
}; align-items: center; height: ${pt(resultRow.height)}; padding: 0 ${pt(resultRow.horizontalInset)}; margin: 0 ${
  pt(resultRow.selectionInsetX)
}; border-radius: ${pt(resultRow.selectionRadius)}; }
    .row.sel { background: var(--selection); }
    .icon { width: 16px; height: 16px; border-radius: 4px; justify-self: center; }
    .text { min-width: 0; } .title { font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub { color: var(--textMuted); font-size: 12px; margin-top: ${
  pt(resultRow.titleToDescriptionGap)
}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tags { display: flex; gap: ${pt(tag.gap)}; align-items: center; }
    .pill { border-radius: ${pt(tag.cornerRadius)}; padding: ${pt(tag.verticalPadding / 2)} ${
  pt(tag.horizontalPadding / 2)
}; font-size: 11px; font-weight: 500; margin-right: 4px; }
    .more { color: var(--textMuted); font-size: 11px; }
    .footer { display: flex; gap: ${pt(footer.pillGap)}; padding: ${pt(footer.panelInset)}; justify-content: flex-end; }
    .footer .fpill:first-child { margin-right: auto; }
    .fpill { display: inline-flex; align-items: center; gap: ${pt(footer.keycapGap)}; padding: ${
  pt(footer.pillVerticalPadding / 2)
} ${
  pt(footer.pillHorizontalPadding)
}; border-radius: 999px; background: var(--raised); border: 1px solid var(--popupBorder); color: var(--textMuted); font-size: 12px; }
    kbd { font: 11px/1 inherit; min-width: 14px; text-align: center; padding: 3px 4px; border-radius: 5px; background: var(--selection); color: var(--text); }
    .split { display: grid; grid-template-columns: ${splitPane.listFraction}fr ${splitPane.detailFraction}fr; min-height: 300px; }
    .split .list-body { border-right: 1px solid var(--divider); }
    .detail { padding: ${pt(layout.components.detail.contentInset)}; display: flex; flex-direction: column; gap: ${
  pt(layout.components.detail.sectionGap)
}; }
    blockquote { margin: 0; padding-left: 10px; border-left: 3px solid; color: var(--textMuted); }
    .card { border: 1px solid var(--divider); border-radius: 10px; overflow: hidden; }
    .meta { display: flex; justify-content: space-between; gap: ${pt(metadata.labelValueGap)}; padding: ${
  pt(metadata.rowGap / 2)
} ${pt(metadata.contentInset)}; font-size: 12px; }
    .meta:nth-child(odd) { background: var(--zebra); } .meta > span:first-child { color: var(--textMuted); }

    .popup { position: absolute; border-radius: ${
  pt(popover.cornerRadius)
}; background: var(--raised); border: 1px solid var(--popupBorder); box-shadow: 0 16px 28px rgba(0,0,0,.56), 0 4px 10px rgba(0,0,0,.34); overflow: hidden; font-size: 12px; color: var(--text); }
    .popup.actions { width: 260px; right: 24px; bottom: 64px; }
    .popup.filter { width: 200px; right: 24px; top: 60px; }
    .popup-body { padding: ${pt(popover.contentInset)}; }
    .popup-bar { border-top: 1px solid var(--popupBorder); color: var(--textFaint); padding: 8px ${
  pt(popover.contentInset)
}; }
    .action { height: ${pt(actionItem.height / 1.4)}; padding: 0 ${pt(actionItem.horizontalInset)}; border-radius: ${
  pt(actionItem.cornerRadius)
}; display: flex; justify-content: space-between; align-items: center; gap: 4px; }
    .action > span:first-child { margin-right: auto; } .action.sel { background: var(--selection); } .keys { color: var(--textMuted); }
    .option { display: flex; gap: ${pt(filterControl.optionGap)}; padding: 4px ${
  pt(actionItem.horizontalInset)
}; } .option span { width: ${pt(filterControl.selectedMarkColumn)}; color: var(--textMuted); }

    .swatches { margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
    .swatch { border: 1px solid #2e3642; border-radius: 8px; overflow: hidden; font-size: 11px; }
    .swatch i { display: block; height: 18px; } .swatch b, .swatch span { display: block; padding: 2px 6px; } .swatch span { color: #aeb7c5; }
  </style>
</head>
<body><div class="wrap">
  <h1>kb palettes</h1>
  <p class="hint">Each palette drawn as kb's list (with the actions and filter popovers) and split pane, on the sample corpus. Tag
  colours hash over the accents as Raycast does; pills are the accent at 20% over the window. The chosen palette comes first.</p>
  ${
  references.length
    ? `<div class="refs">${
      references.map((rel) => `<img src="../../${rel}" alt="Raycast reference ${escape(rel)}" />`).join('')
    }</div>`
    : ''
}
  ${palettes.map(section).join('')}
</div></body>
</html>`

mkdirSync(dirname(htmlOut), { recursive: true })
writeFileSync(htmlOut, page)
console.log(`wrote ${htmlOut}`)
