// Renders tmp/design/palettes.html from palettes + validation.
// Final popup treatment: Variant E.
// Usage: node tools/design/render.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')

const palettes = JSON.parse(readFileSync(resolve(__dirname, 'palettes.json'), 'utf8'))
if (palettes.length !== 1) {
  throw new Error('Expected exactly one palette in tools/design/palettes.json.')
}
const palette = palettes[0]
const layout = JSON.parse(readFileSync(resolve(__dirname, 'layout.json'), 'utf8'))
const validation = new Map(
  JSON.parse(readFileSync(resolve(__dirname, 'validation.json'), 'utf8')).map((v) => [v.id, v])
)
const summary = validation.get(palette.id)

const htmlOut = resolve(root, 'tmp', 'design', 'palettes.html')
mkdirSync(dirname(htmlOut), { recursive: true })

const corpus = {
  commands: readFileSync(resolve(root, 'crates/kb-domain/tests/fixtures/sample/commands.yml'), 'utf8'),
  bookmarks: readFileSync(resolve(root, 'crates/kb-domain/tests/fixtures/sample/bookmarks.yml'), 'utf8'),
  cheats: readFileSync(resolve(root, 'crates/kb-domain/tests/fixtures/sample/cheats.yml'), 'utf8'),
  tasks: readFileSync(resolve(root, 'crates/kb-domain/tests/fixtures/sample/tasks.yml'), 'utf8')
}

const pick = (text, rx, fallback) => {
  const m = text.match(rx)
  return m?.[1]?.trim() ?? fallback
}

const entries = [
  {
    accent: 'green',
    title: pick(corpus.commands, /^\s{2}(.+?):\n\s{4}desc:/m, 'docker ps -a'),
    subtitle: pick(corpus.commands, /^\s{4}desc:\s+(.+)$/m, 'List every container, stopped ones too.'),
    tags: ['#docker', '#containers']
  },
  {
    accent: 'purple',
    title: pick(corpus.bookmarks, /^\s{2}https:\/\/example\.com\/docs:\n\s{4}title:\s+(.+)$/m, 'Example docs'),
    subtitle: pick(
      corpus.bookmarks,
      /^\s{4}description:\s+(.+)$/m,
      'Uses the long spelling of the description field.'
    ),
    tags: ['#docs', '#archived']
  },
  {
    accent: 'blue',
    title: pick(corpus.cheats, /^\s{2}git-rebase:\n\s{4}title:\s+(.+)$/m, 'Interactive rebase'),
    subtitle: pick(corpus.cheats, /^\s{4}cheat:\s+(.+)$/m, 'git rebase -i HEAD~3'),
    tags: ['#git', '#notes']
  },
  {
    accent: 'orange',
    title: pick(corpus.tasks, /^\s{2}port-engine:\n\s{4}task:\s+(.+)$/m, 'Port the kb engine to Rust'),
    subtitle: 'status: in-progress · priority: high',
    tags: ['#rust', '#kb']
  }
]

const references = [
  ['List', 'tools/reports/1-list-ray.png'],
  ['List + split', 'tools/reports/2-list-split-ray.png'],
  ['Split selection', 'tools/reports/3-list-split-down-ray.png'],
  ['Detail', 'tools/reports/4-detail-ray.png'],
  ['Actions', 'tools/reports/5-actions-ray.png'],
  ['Filter', 'tools/reports/6-filter-ray.png'],
  ['Bookmark + split', 'tools/reports/7-bookmark-split-ray.png'],
  ['Bookmark detail', 'tools/reports/8-bookmark-detail-ray.png']
]
  .filter(([, rel]) => existsSync(resolve(root, rel)))
  .map(([name, rel]) => ({ name, rel }))

const roleOrder = [
  'window',
  'header',
  'selection',
  'raised',
  'divider',
  'text',
  'textMuted',
  'textFaint',
  'blue',
  'green',
  'orange',
  'purple',
  'magenta',
  'yellow',
  'red'
]

const mix = (fg, bg, a) => {
  const asRgb = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16))
  const [fr, fgx, fb] = asRgb(fg)
  const [br, bgx, bb] = asRgb(bg)
  const rgb = [
    Math.round(fr * a + br * (1 - a)),
    Math.round(fgx * a + bgx * (1 - a)),
    Math.round(fb * a + bb * (1 - a))
  ]
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const escape = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const checksByStatus = (status) => (summary?.checks ?? []).filter((c) => c.status === status)
const fails = checksByStatus('fail')
const warns = checksByStatus('warn')

const listRows = entries
  .map(
    (r, idx) => `
      <div class="row ${idx === 1 ? 'sel' : ''}" style="--icon:${palette.roles[r.accent]};--tagBg:${
      mix(
        palette.roles[r.accent],
        palette.roles.window,
        0.18
      )
    };--tagText:${mix(palette.roles[r.accent], palette.roles.text, 0.78)}">
        <span class="icon"></span>
        <div>
          <div class="title">${escape(r.title)}</div>
          <div class="sub">${escape(r.subtitle)}</div>
        </div>
        <div class="tags">${r.tags.map((t) => `<span class="pill">${escape(t)}</span>`).join('')}</div>
      </div>`
  )
  .join('')

const swatches = roleOrder
  .map(
    (role) =>
      `<div class="swatch"><i style="background:${palette.roles[role]}"></i><b>${role}</b><span>${
        palette.roles[role]
      }</span></div>`
  )
  .join('')

const popupShadowA = 0.56
const popupShadowB = 0.34
const popupBorder = mix(palette.roles.divider, palette.roles.header, 0.58)
const scrim = 'rgba(6, 10, 18, 0.03)'
const { panel, header, resultRow, tag, popover, actionItem, filterControl } = layout.components
const searchTextStart = header.horizontalInset + resultRow.iconColumn + header.controlGap
const resultTitleStart = layout.spacing.values.compact
  + resultRow.selectionInsetX
  + resultRow.horizontalInset
  + resultRow.iconColumn
  + resultRow.iconToTitleGap
if (searchTextStart !== resultTitleStart) {
  throw new Error(`Header search and result titles are misaligned: ${searchTextStart} != ${resultTitleStart} points.`)
}

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>kb popup separation test</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; padding: 24px; background: #0f1115; color: #e9edf3; font: 14px/1.4 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .wrap { max-width: 1360px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 0; font-size: 18px; }
    p { margin: 0 0 10px; color: #b9c0cc; }
    .summary { background: #171b22; border: 1px solid #2a303b; border-radius: 14px; padding: 12px; margin: 14px 0 18px; }
    .summary-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
    .summary-head small { color: #9ba4b2; font-size: 12px; }
    .badge { border-radius: 999px; padding: 2px 9px; font-size: 12px; font-weight: 600; }
    .badge.pass { background: #1c3f2e; color: #9ef3bb; }
    .badge.warn { background: #46360f; color: #f1ce74; }
    .badge.fail { background: #472026; color: #f1a9b3; }
    .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
    .status-grid h3 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #9fb0c7; }
    .status-grid ul { margin: 0; padding-left: 18px; font-size: 12px; color: #d7deea; }

    .refs { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin: 0 0 16px; }
    .refs figure { margin: 0; background: #141820; border: 1px solid #2a303b; border-radius: 10px; padding: 6px; }
    .refs img { width: 100%; display: block; border-radius: 8px; border: 1px solid #2d3440; }
    .refs figcaption { margin-top: 5px; font-size: 12px; color: #9ea7b5; }

    .scene {
      position: relative;
      border: 1px solid color-mix(in oklab, var(--line) 60%, transparent);
      border-radius: 12px;
      overflow: hidden;
      min-height: 420px;
      background: var(--window);
      padding: var(--frameInset);
    }
    .base-panel { position: relative; z-index: 1; }
    .panel {
      border: 1px solid color-mix(in oklab, var(--line) 68%, transparent);
      border-radius: var(--panelRadius);
      overflow: hidden;
      background: var(--window);
    }
    .bar {
      background: transparent;
      height: var(--headerHeight);
      padding: 0 var(--headerInset);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .query { display: flex; align-items: center; gap: var(--headerControlGap); min-height: 26px; color: var(--text); }
    .lead {
      width: var(--iconColumn);
      height: var(--iconColumn);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--textMuted);
      font-size: 22px;
      line-height: 1;
      font-weight: 400;
      opacity: 0.86;
      transform: translateY(-1px);
    }
    .search-placeholder {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 13px;
      color: var(--textFaint);
      letter-spacing: 0.01em;
      font-weight: 500;
    }
    .cursor {
      width: 2px;
      height: 28px;
      border-radius: 2px;
      background: color-mix(in oklab, var(--text) 88%, var(--window));
      opacity: 0.95;
    }
    .affordance { color: var(--textMuted); font-size: 11px; font-weight: 560; }
    .list-body { padding: var(--listInset) 0; }
    .row {
      display: grid;
      grid-template-columns: var(--iconColumn) 1fr auto;
      column-gap: var(--rowGap);
      align-items: center;
      height: var(--rowHeight);
      padding: 0 var(--rowPaddingX);
      border-radius: var(--rowRadius);
      margin: 0 var(--selectionInsetX) var(--rowGapY);
      position: relative;
    }
    .row.sel::before {
      content: "";
      position: absolute;
      inset: var(--selectionInsetY) 0;
      border-radius: var(--rowRadius);
      background: var(--selection);
    }
    .row > * { position: relative; z-index: 1; }
    .icon { width: 15px; height: 15px; border-radius: 3px; background: var(--icon); justify-self: center; }
    .title { color: var(--text); font-weight: 540; font-size: 11px; line-height: 1.25; }
    .sub { color: var(--textMuted); font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; line-height: 1.25; margin-top: var(--titleDescriptionGap); }
    .tags { display: flex; gap: var(--tagGap); }
    .pill { border-radius: var(--tagRadius); font-size: 9px; padding: var(--tagPaddingY) var(--tagPaddingX); border: 0; background: var(--tagBg); color: var(--tagText); font-weight: 560; letter-spacing: 0.01em; }

    .scrim { position: absolute; inset: 0; z-index: 2; background: var(--scrim); }
    .popup {
      position: absolute;
      z-index: 3;
      border-radius: var(--popoverRadius);
      background: var(--header);
      border: 1px solid var(--popupBorder);
      box-shadow:
        0 16px 28px rgba(0, 0, 0, var(--popupShadowA)),
        0 4px 10px rgba(0, 0, 0, var(--popupShadowB));
      overflow: hidden;
      color: var(--text);
    }
    .popup.actions { width: 320px; top: 248px; left: 66%; transform: translateX(-50%); }
    .popup.filter { width: 284px; top: 62px; left: 76%; transform: translateX(-50%); }
    .popup-bar {
      background: var(--header);
      border-bottom: 1px solid color-mix(in oklab, var(--popupBorder) 70%, transparent);
      color: var(--textMuted);
      padding: 7px var(--popoverInset);
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .popup-body { padding: var(--popoverInset); }
    .action { height: var(--actionItemHeight); padding: 0 var(--actionItemInset); border-radius: var(--actionItemRadius); font-size: 11px; display: flex; justify-content: space-between; align-items: center; }
    .action.sel { background: var(--selection); }
    .keys { color: var(--textMuted); font-size: 10px; }
    .chips { display: flex; gap: var(--filterOptionGap); flex-wrap: wrap; }
    .chip { font-size: 10px; border-radius: 6px; padding: 4px 7px; background: color-mix(in oklab, var(--raised) 75%, transparent); color: var(--textMuted); }
    .chip.on { background: var(--selection); color: var(--text); }

    .swatches { margin-top: 14px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .swatch { border: 1px solid #2e3642; border-radius: 8px; overflow: hidden; font-size: 11px; }
    .swatch i { display: block; height: 18px; }
    .swatch b { display: block; padding: 4px 6px 0; }
    .swatch span { display: block; padding: 0 6px 5px; color: #aeb7c5; }
  </style>
</head>
<body>
  <div class="wrap" style="
    --window:${palette.roles.window};
    --header:${palette.roles.header};
    --selection:${palette.roles.selection};
    --raised:${palette.roles.raised};
    --divider:${palette.roles.divider};
    --line:${mix(palette.roles.divider, palette.roles.window, 0.55)};
    --text:${palette.roles.text};
    --textMuted:${palette.roles.textMuted};
    --textFaint:${palette.roles.textFaint};
    --popupBorder:${popupBorder};
    --popupShadowA:${popupShadowA};
    --popupShadowB:${popupShadowB};
    --scrim:${scrim};
    --frameInset:${panel.outerInset}pt;
    --panelRadius:${panel.cornerRadius}pt;
    --headerHeight:${header.height}pt;
    --headerInset:${header.horizontalInset}pt;
    --headerControlGap:${header.controlGap}pt;
    --iconColumn:${resultRow.iconColumn}pt;
    --rowGap:${resultRow.iconToTitleGap}pt;
    --rowHeight:${resultRow.height}pt;
    --rowPaddingX:${resultRow.horizontalInset}pt;
    --rowRadius:${resultRow.selectionRadius}pt;
    --selectionInsetY:${resultRow.selectionInsetY}pt;
    --titleDescriptionGap:${resultRow.titleToDescriptionGap}pt;
    --rowGapY:${resultRow.verticalGap}pt;
    --selectionInsetX:${resultRow.selectionInsetX}pt;
    --listInset:${layout.spacing.values.compact}pt;
    --tagRadius:${tag.cornerRadius}pt;
    --tagPaddingX:${tag.horizontalPadding}pt;
    --tagPaddingY:${tag.verticalPadding}pt;
    --tagGap:${tag.gap}pt;
    --popoverInset:${popover.contentInset}pt;
    --popoverRadius:${popover.cornerRadius}pt;
    --actionItemHeight:${actionItem.height}pt;
    --actionItemInset:${actionItem.horizontalInset}pt;
    --actionItemRadius:${actionItem.cornerRadius}pt;
    --filterOptionGap:${filterControl.optionGap}pt;
  ">
    <h1>kb popup separation test — final Variant E</h1>
    <p>Final goal: actions and filter read as overlays while still staying close to Raycast's flat look.</p>
    <p>Theme mapping used: base bar transparent; popup background = <code>--header</code>; popup-bar background = <code>--header</code>.</p>

    <section class="summary">
      <div class="summary-head">
        <div>
          <h2>${escape(palette.name)}</h2>
          <small><a href="${escape(palette.source)}">${escape(palette.source)}</a></small>
        </div>
        <span class="badge ${summary?.failed ? 'fail' : summary?.warned ? 'warn' : 'pass'}">${
  summary?.failed ? 'Fail' : summary?.warned ? 'Warn' : 'Pass'
}</span>
      </div>
      <div class="status-grid">
        <div>
          <h3>Fails (${fails.length})</h3>
          <ul>${
  fails.length
    ? fails.map((c) => `<li>${escape(c.name)} (${c.value})${c.pair ? ` [${c.pair}]` : ''}</li>`).join('')
    : '<li>none</li>'
}</ul>
        </div>
        <div>
          <h3>Warns (${warns.length})</h3>
          <ul>${
  warns.length
    ? warns.map((c) => `<li>${escape(c.name)} (${c.value})${c.pair ? ` [${c.pair}]` : ''}</li>`).join('')
    : '<li>none</li>'
}</ul>
        </div>
      </div>
    </section>

    ${
  references.length
    ? `<section class="refs">${
      references
        .map(
          ({ name, rel }) =>
            `<figure><img src="../../${rel}" alt="${name} reference" /><figcaption>Raycast reference — ${name}</figcaption></figure>`
        )
        .join('')
    }</section>`
    : ''
}

    <section class="scene">
      <div class="base-panel">
        <div class="panel">
          <div class="bar">
            <div class="query">
              <span class="lead">‹</span>
              <span class="search-placeholder"><span class="cursor"></span>Search knowledge base…</span>
            </div>
            <div class="affordance">All Entries ⌄</div>
          </div>
          <div class="list-body">${listRows}</div>
        </div>
      </div>
      <div class="scrim"></div>
      <div class="popup actions">
        <div class="popup-bar"><span>Actions</span><span class="keys">⌘K</span></div>
        <div class="popup-body">
          <div class="action sel"><span>Open</span><span class="keys">↵</span></div>
          <div class="action"><span>Copy URL</span><span class="keys">⌘C</span></div>
          <div class="action"><span>Open source file</span><span class="keys">⌘O</span></div>
        </div>
      </div>
      <div class="popup filter">
        <div class="popup-bar"><span>Filter</span><span class="keys">⌘P</span></div>
        <div class="popup-body chips">
          <span class="chip on">commands</span>
          <span class="chip">bookmarks</span>
          <span class="chip on">#git</span>
          <span class="chip">#docker</span>
        </div>
      </div>
    </section>

    <section>
      <h2 style="margin:14px 0 8px; font-size:16px;">Palette swatches</h2>
      <div class="swatches">${swatches}</div>
    </section>
  </div>
</body>
</html>`

writeFileSync(htmlOut, page)
console.log(`wrote ${htmlOut}`)
