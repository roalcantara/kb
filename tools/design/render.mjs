// Renders tmp/design/palettes.html from palettes + validation.
// Usage: node tools/design/render.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");

const palettes = JSON.parse(readFileSync(resolve(__dirname, "palettes.json"), "utf8"));
const validation = new Map(
  JSON.parse(readFileSync(resolve(__dirname, "validation.json"), "utf8")).map((v) => [v.id, v]),
);

const htmlOut = resolve(root, "tmp", "design", "palettes.html");
mkdirSync(dirname(htmlOut), { recursive: true });

const corpus = {
  commands: readFileSync(resolve(root, "crates/kb-domain/tests/fixtures/sample/commands.yml"), "utf8"),
  bookmarks: readFileSync(resolve(root, "crates/kb-domain/tests/fixtures/sample/bookmarks.yml"), "utf8"),
  cheats: readFileSync(resolve(root, "crates/kb-domain/tests/fixtures/sample/cheats.yml"), "utf8"),
  tasks: readFileSync(resolve(root, "crates/kb-domain/tests/fixtures/sample/tasks.yml"), "utf8"),
};

const pick = (text, rx, fallback) => {
  const m = text.match(rx);
  return m?.[1]?.trim() ?? fallback;
};

const rows = [
  {
    type: "commands",
    accent: "green",
    title: pick(corpus.commands, /^\s{2}(.+?):\n\s{4}desc:/m, "docker ps -a"),
    subtitle: pick(corpus.commands, /^\s{4}desc:\s+(.+)$/m, "List every container, stopped ones too."),
    tags: ["#docker", "#containers"],
  },
  {
    type: "bookmarks",
    accent: "purple",
    title: pick(corpus.bookmarks, /^\s{2}https:\/\/example\.com\/docs:\n\s{4}title:\s+(.+)$/m, "Example docs"),
    subtitle: pick(
      corpus.bookmarks,
      /^\s{4}description:\s+(.+)$/m,
      "Uses the long spelling of the description field.",
    ),
    tags: ["#docs", "#archived"],
  },
  {
    type: "cheats",
    accent: "blue",
    title: pick(corpus.cheats, /^\s{2}git-rebase:\n\s{4}title:\s+(.+)$/m, "Interactive rebase"),
    subtitle: pick(corpus.cheats, /^\s{4}cheat:\s+(.+)$/m, "git rebase -i HEAD~3"),
    tags: ["#git", "#notes"],
  },
  {
    type: "tasks",
    accent: "orange",
    title: pick(corpus.tasks, /^\s{2}port-engine:\n\s{4}task:\s+(.+)$/m, "Port the kb engine to Rust"),
    subtitle: "status: in-progress · priority: high",
    tags: ["#rust", "#kb"],
  },
];

const references = [
  "tools/reports/1-list-ray.png",
  "tools/reports/2-list-split-ray.png",
].filter((rel) => existsSync(resolve(root, rel)));

const roleOrder = [
  "window",
  "header",
  "selection",
  "raised",
  "divider",
  "text",
  "textMuted",
  "textFaint",
  "blue",
  "green",
  "orange",
  "purple",
  "magenta",
  "yellow",
  "red",
];

const mix = (fg, bg, a) => {
  const asRgb = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const [fr, fgx, fb] = asRgb(fg);
  const [br, bgx, bb] = asRgb(bg);
  const rgb = [
    Math.round(fr * a + br * (1 - a)),
    Math.round(fgx * a + bgx * (1 - a)),
    Math.round(fb * a + bb * (1 - a)),
  ];
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const badge = (summary) => {
  if (!summary || summary.failed > 0) return ["fail", "Fail"];
  if (summary.warned > 0) return ["warn", "Warn"];
  return ["pass", "Pass"];
};

const escape = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>kb palette comparison</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; padding: 24px; background: #0f1115; color: #e9edf3;
      font: 14px/1.4 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 14px; color: #b9c0cc; }
    .refs { display: flex; gap: 16px; flex-wrap: wrap; margin: 0 0 22px; }
    .refs figure { margin: 0; }
    .refs img { width: min(560px, 100%); border-radius: 12px; border: 1px solid #2d3440; display: block; }
    .refs figcaption { margin-top: 6px; color: #9ea7b5; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 16px; }
    .card { background: #171b22; border: 1px solid #2a303b; border-radius: 14px; padding: 14px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .head h2 { margin: 0; font-size: 16px; }
    .head small { color: #9ba4b2; font-size: 12px; }
    .badge { border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
    .badge.pass { background: #1c3f2e; color: #9ef3bb; }
    .badge.warn { background: #46360f; color: #f1ce74; }
    .badge.fail { background: #472026; color: #f1a9b3; }
    .failures { margin: 8px 0 10px; padding-left: 18px; color: #d7deea; font-size: 12px; }
    .mock { border-radius: 14px; overflow: hidden; border: 1px solid var(--divider); background: var(--window); color: var(--text); }
    .search { background: var(--header); border-bottom: 1px solid var(--divider); padding: 12px; display: flex; justify-content: space-between; align-items: center; }
    .input { font-size: 14px; }
    .hint { color: var(--textFaint); margin-left: 8px; }
    .filter { background: var(--raised); color: var(--textMuted); border: 1px solid var(--divider); border-radius: 999px; padding: 5px 9px; font-size: 12px; }
    .layout { display: grid; grid-template-columns: 1.35fr 1fr; min-height: 280px; }
    .list { padding: 8px; border-right: 1px solid var(--divider); }
    .row { display: grid; grid-template-columns: 18px 1fr auto; gap: 8px; align-items: center; padding: 8px; border-radius: 10px; margin-bottom: 4px; }
    .row.sel { background: var(--selection); }
    .icon { width: 14px; height: 14px; border-radius: 3px; background: var(--icon); }
    .title { color: var(--text); font-weight: 500; font-size: 13px; }
    .sub { color: var(--textMuted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
    .tags { display: flex; gap: 4px; }
    .pill {
      border-radius: 999px; font-size: 11px; padding: 1px 6px; border: 1px solid color-mix(in oklab, var(--tag) 50%, #000 50%);
      background: var(--tagBg); color: var(--tag);
    }
    .meta { padding: 10px; display: grid; grid-template-rows: repeat(3, min-content); gap: 8px; }
    .meta .rowx { background: var(--raised); border: 1px solid var(--divider); border-radius: 9px; padding: 8px; }
    .meta .k { color: var(--textMuted); font-size: 12px; margin-bottom: 4px; }
    .meta .v { color: var(--text); font-size: 12px; }
    .footer { border-top: 1px solid var(--divider); background: var(--header); display: flex; justify-content: space-between; padding: 8px 10px; }
    .footpill { background: var(--raised); color: var(--textMuted); border: 1px solid var(--divider); border-radius: 999px; padding: 3px 9px; font-size: 11px; }
    .keycap { background: var(--raised); color: var(--text); border: 1px solid var(--divider); border-radius: 6px; padding: 1px 5px; font-size: 11px; margin-left: 5px; }
    .swatches { margin-top: 10px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .swatch { border: 1px solid #2e3642; border-radius: 8px; overflow: hidden; font-size: 11px; }
    .swatch i { display: block; height: 20px; }
    .swatch b { display: block; padding: 4px 6px 0; }
    .swatch span { display: block; padding: 0 6px 5px; color: #aeb7c5; }
  </style>
</head>
<body>
  <h1>kb palette comparison</h1>
  <p>Reference screenshots on top (if present). Mockups use sample corpus rows from <code>crates/kb-domain/tests/fixtures/sample/*.yml</code>.</p>
  ${
    references.length
      ? `<section class="refs">${references
          .map((rel) => `<figure><img src="../../${rel}" alt="${rel}" /><figcaption>${rel}</figcaption></figure>`)
          .join("")}</section>`
      : ""
  }
  <section class="grid">
    ${palettes
      .map((p) => {
        const v = validation.get(p.id);
        const [cls, label] = badge(v);
        const problems = (v?.checks ?? []).filter((c) => c.status !== "pass");
        const list = problems.length
          ? `<ul class="failures">${problems
              .map((c) => `<li>${escape(c.name)} — ${c.status.toUpperCase()} (${c.value})${c.pair ? ` [${c.pair}]` : ""}</li>`)
              .join("")}</ul>`
          : "";

        const rowHtml = rows
          .map(
            (r, idx) => `
            <div class="row ${idx === 1 ? "sel" : ""}" style="--icon:${p.roles[r.accent]};--tag:${p.roles[r.accent]};--tagBg:${mix(
              p.roles[r.accent],
              p.roles.window,
              0.2,
            )}">
              <span class="icon"></span>
              <div>
                <div class="title">${escape(r.title)}</div>
                <div class="sub">${escape(r.subtitle)}</div>
              </div>
              <div class="tags">${r.tags.map((t) => `<span class="pill">${escape(t)}</span>`).join("")}</div>
            </div>`,
          )
          .join("");

        const swatches = roleOrder
          .map(
            (role) => `<div class="swatch"><i style="background:${p.roles[role]}"></i><b>${role}</b><span>${p.roles[role]}</span></div>`,
          )
          .join("");

        return `
        <article class="card">
          <div class="head">
            <div><h2>${escape(p.name)} <small>(${p.id})</small></h2><small><a href="${escape(p.source)}">${escape(p.source)}</a></small></div>
            <span class="badge ${cls}">${label}</span>
          </div>
          ${list}
          <div class="mock" style="
            --window:${p.roles.window};
            --header:${p.roles.header};
            --selection:${p.roles.selection};
            --raised:${p.roles.raised};
            --divider:${p.roles.divider};
            --text:${p.roles.text};
            --textMuted:${p.roles.textMuted};
            --textFaint:${p.roles.textFaint};
          ">
            <div class="search"><div class="input">docker <span class="hint">Search entries…</span></div><button class="filter">All Entries ⌄</button></div>
            <div class="layout">
              <div class="list">${rowHtml}</div>
              <div class="meta">
                <div class="rowx"><div class="k">Type</div><div class="v"><span class="pill" style="--tag:${p.roles.purple};--tagBg:${mix(p.roles.purple, p.roles.window, 0.2)}">#bookmarks</span></div></div>
                <div class="rowx"><div class="k">Tags</div><div class="v"><span class="pill" style="--tag:${p.roles.blue};--tagBg:${mix(p.roles.blue, p.roles.window, 0.2)}">#docs</span> <span class="pill" style="--tag:${p.roles.green};--tagBg:${mix(p.roles.green, p.roles.window, 0.2)}">#video</span></div></div>
                <div class="rowx"><div class="k">Source</div><div class="v">sample/bookmarks.yml</div></div>
              </div>
            </div>
            <div class="footer">
              <span class="footpill">Open</span>
              <span class="footpill">Actions <span class="keycap">⌘</span><span class="keycap">K</span></span>
            </div>
          </div>
          <div class="swatches">${swatches}</div>
        </article>`;
      })
      .join("")}
  </section>
</body>
</html>`;

writeFileSync(htmlOut, page);
console.log(`wrote ${htmlOut}`);
