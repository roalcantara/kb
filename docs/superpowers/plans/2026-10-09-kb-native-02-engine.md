# kb native port — Plan 2: The engine at golden parity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `kb-domain` — the kb engine in Rust — reproducing the TypeScript engine's output on both corpora, and
`kb-bench` measuring it with the same cases, sampler and results schema as `bench/ts`.

**Architecture:** One module per TypeScript file of `packages/domain/kb`, each written test-first. Every external
concern is bought (D7): `saphyr` reads and writes YAML, `rusqlite` (bundled SQLite) holds the index, `walkdir`
finds sources, `serde_json` writes JSON, `base64` encodes images. Only the subset of `json2md` the notes use is
built — no crate implements it. The sources follow the spec's source schema (D9), so there is no
JavaScript-compatibility layer. Parity is proven by golden tests against the TypeScript engine's output.

**Tech Stack:** Rust 1.99 (edition 2024), saphyr 0.1, rusqlite 0.37 (bundled SQLite 3.50), walkdir 2,
serde_json 1 (`preserve_order`), base64 0.22, indexmap 2, thiserror 2, tempfile 3.

**Spec:** [2026-10-08-kb-native-port-experiment-design.md](../specs/2026-10-08-kb-native-port-experiment-design.md)
— read D7–D10, "Source schema (D9)" and "Parity and testing" first.

---

## Before you start

Every block of code in this plan was compiled and run before the plan was written, against the corpora this
repository holds on 2026-10-09: rustfmt clean, `cargo clippy --all-targets -- -D warnings` with this
workspace's lints clean, `RUSTDOCFLAGS=-D warnings cargo doc` clean, 34 unit tests and 3 golden tests passing on
both `sample` and `private` (4,233 rows, 30 queries), `cargo deny check` and `cargo machete` clean. Type it as
written. If a step's expected output differs, stop and report it rather than adapting the code.

What is deliberately **not** here (D8, D9):

- `raw_yaml` is written with `saphyr`'s emitter and compared with the goldens **by value**, not by bytes.
- A parse error is compared by file, line and column; its message is `saphyr`'s own.
- No handling for data outside the source schema — aliases resolved into shared objects, integer-like keys in
  multi-key maps, empty values. The sources were normalized instead; the sync report lists any new deviation.
- `renderSearchSql` (inlined SQL literals) is not ported: it exists only because Raycast's `executeSQL` takes no
  parameters. The port binds parameters.

## Conventions

As Plan 1: work in `~/Work/rust/kb`; commits are `type(scope): Sentence case subject` with the attribution line;
hooks run on every commit — if one fixes files, review, `git add` them, and commit again.

## File map

| Path                                                                               | Responsibility                                            | Task  |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- | ----- |
| `Cargo.toml`                                                                       | workspace dependencies and members                        | 1, 12 |
| `crates/kb-domain/Cargo.toml`                                                      | the engine's dependencies                                 | 1     |
| `crates/kb-domain/src/lib.rs`                                                      | module list                                               | 1–10  |
| `crates/kb-domain/src/yaml.rs`                                                     | load, read and write YAML through `saphyr`                | 2     |
| `crates/kb-domain/src/entry.rs`                                                    | `Entry`, ids, primary content, tags, links, normalization | 3     |
| `crates/kb-domain/src/markdown.rs`                                                 | notes → Markdown, the `json2md` subset                    | 4     |
| `crates/kb-domain/src/row.rs`                                                      | `IndexRow`, searchable text, entry ↔ row                  | 5     |
| `crates/kb-domain/src/query.rs`                                                    | search text → FTS5 prefix query                           | 6     |
| `crates/kb-domain/src/search.rs`                                                   | filter, query, SQL, one page of rows                      | 7     |
| `crates/kb-domain/src/source.rs`                                                   | finding and reading source files; scanning                | 8     |
| `crates/kb-domain/src/report.rs`                                                   | per-file sync report and excerpts                         | 9     |
| `crates/kb-domain/src/schema.sql`, `sync.rs`                                       | the index schema; the transactional rebuild               | 10    |
| `crates/kb-domain/tests/goldens.rs`                                                | parity with the TypeScript engine                         | 11    |
| `crates/kb-bench/**`                                                               | tier 1 benchmarks in the shared schema                    | 12    |
| `mise.toml`, `hk.pkl`, `CONTEXT.md`, `README.md`, `docs/experiment/methodology.md` | tasks, gates, docs                                        | 11–14 |

---

### Task 1: Dependencies

**Files:**

- Modify: `Cargo.toml` (`[workspace.dependencies]`)

- [ ] **Step 1: Declare the workspace dependencies**

In `Cargo.toml`, replace the empty `[workspace.dependencies]` table with:

```toml
[workspace.dependencies]
base64 = "0.22"
indexmap = "2"
rusqlite = { version = "0.37", features = ["bundled"] }
saphyr = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = { version = "1", features = ["preserve_order"] }
tempfile = "3"
thiserror = "2"
walkdir = "2"
```

These are the versions the code below was verified with. `rusqlite`'s `bundled` feature compiles SQLite with
FTS5. `serde_json`'s `preserve_order` keeps object keys in source order, as `JSON.stringify` does.

- [ ] **Step 2: Verify and commit**

The crates are declared once here; each task adds to `crates/kb-domain/Cargo.toml` exactly the ones it starts to
use, so `cargo machete` never sees an unused dependency.

Run: `cargo check --workspace`

Expected: `Finished`.

```bash
git add Cargo.toml Cargo.lock
git commit -m "build: Declare the engine's workspace dependencies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: YAML through saphyr

**Files:**

- Create: `crates/kb-domain/src/yaml.rs`
- Modify: `crates/kb-domain/src/lib.rs`, `crates/kb-domain/Cargo.toml`

The sources follow one schema, so `saphyr`'s loader is used as it is. `emit` writes `raw_yaml`; Copy Raw YAML, its only reader in the app, is deferred (D8).

- [ ] **Step 1: Register the module and write its tests**

Add to `[dependencies]` in `crates/kb-domain/Cargo.toml` (create the table if it is not there yet):

```toml
saphyr.workspace = true
serde_json.workspace = true
thiserror.workspace = true
```

Add `pub mod yaml;` to `crates/kb-domain/src/lib.rs`, keeping the `pub mod` lines sorted. Create
`crates/kb-domain/src/yaml.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_an_empty_source_as_no_document() {
        assert_eq!(load(""), Ok(None));
        assert_eq!(load("# a comment\n"), Ok(None));
    }

    #[test]
    fn reports_where_a_source_breaks() {
        let error = load("a: 1\nb: [2\n").unwrap_err();
        assert_eq!((error.line, error.column), (3, 1));
    }

    #[test]
    fn reads_fields_and_strings() {
        let doc = load("title: kb\ncount: 2\n").unwrap().unwrap();
        assert_eq!(field(&doc, "title").and_then(as_str), Some("kb"));
        assert_eq!(field(&doc, "count").and_then(as_str), None);
        assert_eq!(field(&doc, "count").and_then(scalar_text).as_deref(), Some("2"));
    }

    #[test]
    fn writes_yaml_that_reads_back_as_the_same_value() {
        let doc = load("a: [1, two]\nb:\n  c: |\n    multi\n    line\n").unwrap().unwrap();
        assert_eq!(load(&emit(&doc)).unwrap(), Some(doc));
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-domain yaml`

Expected: compilation fails — `error[E0425]: cannot find function `load` in this scope (and similar)`.

- [ ] **Step 3: Write the implementation above the tests**

Insert at the top of `crates/kb-domain/src/yaml.rs`, before `#[cfg(test)]`:

```rust
//! The YAML the engine reads and writes, through `saphyr`.
//!
//! The sources follow one schema (see the design spec, "Source schema"), so the engine reads
//! them with `saphyr`'s loader as it is: no JavaScript-compatibility layer.

use saphyr::{LoadableYamlNode, ScalarOwned, Yaml, YamlEmitter, YamlOwned};

/// Why a source did not parse, and where: 1-based line and column.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{message}")]
pub struct YamlError {
    /// The parser's own description.
    pub message: String,
    /// 1-based line.
    pub line: usize,
    /// 1-based column.
    pub column: usize,
}

/// Parses the first document of `source`; an empty source is `None`.
///
/// # Errors
///
/// The scanner's error, with its position.
pub fn load(source: &str) -> Result<Option<YamlOwned>, YamlError> {
    YamlOwned::load_from_str(source)
        .map(|documents| documents.into_iter().next())
        .map_err(|error| YamlError {
            message: error.info().to_owned(),
            line: error.marker().line(),
            // saphyr's marker column is 0-based.
            column: error.marker().col() + 1,
        })
}

/// The text of a scalar: strings as they are, other scalars in their YAML spelling.
#[must_use]
pub fn scalar_text(node: &YamlOwned) -> Option<String> {
    match node {
        YamlOwned::Value(ScalarOwned::String(s)) => Some(s.clone()),
        YamlOwned::Value(ScalarOwned::Integer(i)) => Some(i.to_string()),
        YamlOwned::Value(ScalarOwned::FloatingPoint(f)) => Some(f.to_string()),
        YamlOwned::Value(ScalarOwned::Boolean(b)) => Some(b.to_string()),
        YamlOwned::Value(ScalarOwned::Null) => Some("null".to_owned()),
        _ => None,
    }
}

/// The string a node holds, if it is a string.
#[must_use]
pub fn as_str(node: &YamlOwned) -> Option<&str> {
    match node {
        YamlOwned::Value(ScalarOwned::String(s)) => Some(s),
        _ => None,
    }
}

/// A field of a mapping, by name.
#[must_use]
pub fn field<'a>(map: &'a YamlOwned, name: &str) -> Option<&'a YamlOwned> {
    match map {
        YamlOwned::Mapping(entries) => entries.iter().find(|(k, _)| as_str(k) == Some(name)).map(|(_, v)| v),
        _ => None,
    }
}

/// Whether a node is null or absent in the sense of JavaScript's `??`.
#[must_use]
pub fn is_null(node: &YamlOwned) -> bool {
    matches!(node, YamlOwned::Value(ScalarOwned::Null) | YamlOwned::BadValue)
}

/// The node as JSON: notes blocks whose content is not text are shown as JSON.
#[must_use]
pub fn to_json(node: &YamlOwned) -> serde_json::Value {
    use serde_json::Value as Json;
    match node {
        YamlOwned::Value(ScalarOwned::String(s)) => Json::String(s.clone()),
        YamlOwned::Value(ScalarOwned::Integer(i)) => Json::from(*i),
        YamlOwned::Value(ScalarOwned::FloatingPoint(f)) => Json::from(f.into_inner()),
        YamlOwned::Value(ScalarOwned::Boolean(b)) => Json::Bool(*b),
        YamlOwned::Sequence(items) => Json::Array(items.iter().map(to_json).collect()),
        YamlOwned::Mapping(entries) => Json::Object(
            entries
                .iter()
                .map(|(k, v)| (scalar_text(k).unwrap_or_default(), to_json(v)))
                .collect(),
        ),
        YamlOwned::Tagged(_, inner) => to_json(inner),
        _ => Json::Null,
    }
}

/// The node written back as YAML, for `raw_yaml`.
#[must_use]
pub fn emit(node: &YamlOwned) -> String {
    let mut out = String::new();
    // Writing to a String cannot fail; an emitter error leaves what was written so far.
    let _ = YamlEmitter::new(&mut out).dump(&Yaml::from(node));
    out.push('\n');
    out
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p kb-domain yaml && cargo clippy -p kb-domain --all-targets -- -D warnings`

Expected: 4 passed (plus any tests of earlier modules the filter matches); clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-domain/src/lib.rs crates/kb-domain/src/yaml.rs crates/kb-domain/Cargo.toml Cargo.lock
git commit -m "feat(domain): Read and write YAML through saphyr

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: The entry

**Files:**

- Create: `crates/kb-domain/src/entry.rs`
- Modify: `crates/kb-domain/src/lib.rs`, `crates/kb-domain/Cargo.toml`

`normalize_entry` is `normalizeEntry` field by field: `title` falls back to the key, `desc` to `description`, tags are trimmed and lowercased, links keep `title: url` pairs, task columns are read only for task types.

- [ ] **Step 1: Register the module and write its tests**

Add to `[dependencies]` in `crates/kb-domain/Cargo.toml` (create the table if it is not there yet):

```toml
serde.workspace = true
```

Add `pub mod entry;` to `crates/kb-domain/src/lib.rs`, keeping the `pub mod` lines sorted. Create
`crates/kb-domain/src/entry.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn raw(source: &str) -> YamlOwned {
        yaml::load(source).unwrap().unwrap()
    }

    #[test]
    fn derives_ids_with_forward_slashes_and_no_leading_slash() {
        assert_eq!(
            derive_entry_id("/misc\\snippets.yaml", "snippets", "Hello"),
            "misc/snippets.yaml#snippets#Hello"
        );
    }

    #[test]
    fn prefers_explicit_fields_for_primary_content() {
        assert_eq!(primary_content(&raw("cmd: ' ls -la '\n"), "key"), "ls -la");
        assert_eq!(primary_content(&raw("title: t\n"), " key "), "key");
    }

    #[test]
    fn normalizes_links_from_urls_and_titled_maps() {
        let links = normalize_links(Some(&raw(
            "[https://a.example, {Guide: https://b.example, API: ' '}, 3]",
        )));
        assert_eq!(
            links,
            [
                EntryLink {
                    title: None,
                    url: "https://a.example".into()
                },
                EntryLink {
                    title: Some("Guide".into()),
                    url: "https://b.example".into()
                },
            ]
        );
    }

    #[test]
    fn normalizes_tags_from_a_list_or_a_string() {
        assert_eq!(normalize_tags(Some(&raw("[Git, ' Talks ', '']"))), ["git", "talks"]);
        assert_eq!(normalize_tags(Some(&raw("Mixed-Case"))), ["mixed-case"]);
        assert_eq!(normalize_tags(None), Vec::<String>::new());
    }

    #[test]
    fn reads_task_columns_only_for_tasks() {
        let source = raw("status: done\npriority: high\n");
        assert_eq!(
            normalize_entry("/f", "f", "tasks", "k", &source).task_status.as_deref(),
            Some("done")
        );
        assert_eq!(normalize_entry("/f", "f", "bookmarks", "k", &source).task_status, None);
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-domain entry`

Expected: compilation fails — `error[E0425]: cannot find function `derive_entry_id``.

- [ ] **Step 3: Write the implementation above the tests**

Insert at the top of `crates/kb-domain/src/entry.rs`, before `#[cfg(test)]`:

```rust
//! The entry: one knowledge node, normalized from its YAML.

use saphyr::YamlOwned;
use serde::{Deserialize, Serialize};

use crate::yaml::{self, as_str, field, is_null};

/// A link attached to an entry: a bare URL, or a titled one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EntryLink {
    /// The title, when the source gave one (`- Guide: https://…`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// The URL.
    pub url: String,
}

/// One knowledge node users can search and open.
#[derive(Debug, Clone, PartialEq)]
pub struct Entry {
    /// `<rel path>#<type>#<key>`.
    pub id: String,
    /// An explicit `title:`, else the key.
    pub title: String,
    /// `desc:` or `description:`.
    pub description: Option<String>,
    /// The top-level YAML key the entry sits under.
    pub entry_type: String,
    /// Lowercased `tags:` (or `tag:`).
    pub tags: Vec<String>,
    /// The notes as the source wrote them.
    pub notes: Option<YamlOwned>,
    /// The notes compiled to Markdown; empty until a sync compiles them.
    pub notes_markdown: String,
    /// Attached links.
    pub links: Vec<EntryLink>,
    /// The absolute path of the source file.
    pub source_file: String,
    /// The source file's path relative to the sources directory.
    pub source_rel_path: String,
    /// What the main action opens or copies.
    pub primary_content: String,
    /// Task entries only: `status:`.
    pub task_status: Option<String>,
    /// Task entries only: `priority:`.
    pub task_priority: Option<String>,
    /// The entry's map written back as YAML.
    pub raw_yaml: String,
}

/// `<rel path>#<type>#<key>`, the path with forward slashes and no leading slash. Case is kept:
/// the id is the index's primary key.
#[must_use]
pub fn derive_entry_id(source_rel_path: &str, entry_type: &str, key: &str) -> String {
    let path = source_rel_path.replace('\\', "/");
    format!("{}#{entry_type}#{key}", path.trim_start_matches('/'))
}

/// A trimmed, non-empty string field; `None` when absent, blank or not a string.
#[must_use]
pub fn raw_string(raw: &YamlOwned, name: &str) -> Option<String> {
    field(raw, name)
        .and_then(as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

/// The explicit `url`, `cmd`, `cheat` or `task` field, else the key: bookmarks and commands put
/// their payload in the key.
#[must_use]
pub fn primary_content(raw: &YamlOwned, key: &str) -> String {
    ["url", "cmd", "cheat", "task"]
        .iter()
        .find_map(|name| raw_string(raw, name))
        .unwrap_or_else(|| key.trim().to_owned())
}

/// Links from a list of URLs or `title: url` maps; anything else is dropped.
#[must_use]
pub fn normalize_links(links: Option<&YamlOwned>) -> Vec<EntryLink> {
    let Some(YamlOwned::Sequence(items)) = links else {
        return Vec::new();
    };
    items
        .iter()
        .flat_map(|item| match item {
            YamlOwned::Mapping(pairs) => pairs
                .iter()
                .filter_map(|(title, url)| {
                    let url = as_str(url)?.trim();
                    (!url.is_empty()).then(|| EntryLink {
                        title: Some(yaml::scalar_text(title).unwrap_or_default().trim().to_owned()),
                        url: url.to_owned(),
                    })
                })
                .collect::<Vec<_>>(),
            _ => as_str(item)
                .map(str::trim)
                .filter(|url| !url.is_empty())
                .map(|url| EntryLink {
                    title: None,
                    url: url.to_owned(),
                })
                .into_iter()
                .collect(),
        })
        .collect()
}

/// Tags from a list or a single string, trimmed, lowercased, blanks dropped.
#[must_use]
pub fn normalize_tags(tags: Option<&YamlOwned>) -> Vec<String> {
    let tidy = |tag: String| Some(tag.trim().to_lowercase()).filter(|t| !t.is_empty());
    match tags {
        Some(YamlOwned::Sequence(items)) => items.iter().filter_map(yaml::scalar_text).filter_map(tidy).collect(),
        Some(node) => as_str(node).map(str::to_owned).and_then(tidy).into_iter().collect(),
        None => Vec::new(),
    }
}

/// A field, unless it is null: JavaScript's `raw.a ?? raw.b`.
fn present<'a>(raw: &'a YamlOwned, name: &str) -> Option<&'a YamlOwned> {
    field(raw, name).filter(|node| !is_null(node))
}

/// Normalizes one entry from its source map.
#[must_use]
pub fn normalize_entry(
    source_file: &str,
    source_rel_path: &str,
    entry_type: &str,
    key: &str,
    raw: &YamlOwned,
) -> Entry {
    let is_task = entry_type.to_lowercase().contains("task");
    Entry {
        id: derive_entry_id(source_rel_path, entry_type, key),
        title: raw_string(raw, "title").unwrap_or_else(|| key.trim().to_owned()),
        description: raw_string(raw, "desc").or_else(|| raw_string(raw, "description")),
        entry_type: entry_type.to_owned(),
        tags: normalize_tags(present(raw, "tags").or_else(|| present(raw, "tag"))),
        notes: present(raw, "notes").cloned(),
        notes_markdown: String::new(),
        links: normalize_links(field(raw, "links")),
        source_file: source_file.to_owned(),
        source_rel_path: source_rel_path.to_owned(),
        primary_content: primary_content(raw, key),
        task_status: if is_task { raw_string(raw, "status") } else { None },
        task_priority: if is_task { raw_string(raw, "priority") } else { None },
        raw_yaml: yaml::emit(raw),
    }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p kb-domain entry && cargo clippy -p kb-domain --all-targets -- -D warnings`

Expected: 5 passed (plus any tests of earlier modules the filter matches); clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-domain/src/lib.rs crates/kb-domain/src/entry.rs crates/kb-domain/Cargo.toml Cargo.lock
git commit -m "feat(domain): Normalize entries from their YAML

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Notes as Markdown

**Files:**

- Create: `crates/kb-domain/src/markdown.rs`
- Modify: `crates/kb-domain/src/lib.rs`, `crates/kb-domain/Cargo.toml`

The blocks are the TypeScript engine's, in its order: YouTube thumbnail (bookmarks), command snippet (commands), description blockquote, notes, LINKS list, source footer. `render` is the part of `json2md` those blocks use: a typed block ends with a newline, a text block does not, blocks join with `\n`. A blockquote prefixes after every JavaScript line terminator, as `/^/gm` does.

- [ ] **Step 1: Register the module and write its tests**

Add to `[dependencies]` in `crates/kb-domain/Cargo.toml` (create the table if it is not there yet):

```toml
base64.workspace = true
```

Add `pub mod markdown;` to `crates/kb-domain/src/lib.rs`, keeping the `pub mod` lines sorted. Create
`crates/kb-domain/src/markdown.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_youtube_ids() {
        assert_eq!(
            youtube_video_id("https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=1"),
            Some("aqz-KE-bpKQ")
        );
        assert_eq!(youtube_video_id("https://youtu.be/wNw9fKErhdg"), Some("wNw9fKErhdg"));
        assert_eq!(youtube_video_id("https://example.com"), None);
    }

    #[test]
    fn prefixes_after_every_javascript_line_terminator() {
        assert_eq!(prefix_lines("a\nb\r\nc", "> "), "> a\n> b\r> \n> c");
    }

    #[test]
    fn rewrites_emphasis_tags_in_list_items() {
        assert_eq!(text_format("<STRONG>a</strong> <em>b</em>"), "**a** *b*");
    }

    #[test]
    fn indents_every_line_but_the_first() {
        assert_eq!(indent_rest("a\nb\nc", 4), "a\n    b\n    c");
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-domain markdown`

Expected: compilation fails — `error[E0425]: cannot find function `youtube_video_id``.

- [ ] **Step 3: Write the implementation above the tests**

Insert at the top of `crates/kb-domain/src/markdown.rs`, before `#[cfg(test)]`:

````rust
//! An entry's notes, description, links and provenance as Markdown.
//!
//! The output matches the TypeScript engine byte for byte. That engine builds a list of blocks
//! and renders them with `json2md`; this module keeps the same blocks and renders the subset of
//! `json2md` they use. No crate implements `json2md`, and the subset is small.

use base64::Engine as _;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use saphyr::YamlOwned;

use crate::entry::Entry;
use crate::yaml::{as_str, to_json};

/// One `json2md` block.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Block {
    /// Inserted as it is.
    Text(String),
    /// `![](source "title")`
    Image { title: &'static str, source: String },
    /// A fenced code block.
    Code { language: String, content: String },
    /// Every line prefixed with `> `.
    Blockquote(String),
    /// `### text`
    H3(&'static str),
    /// ` - item` per item.
    List(Vec<String>),
}

/// Aliases the TS engine maps to a canonical fence language; any other language is kept.
fn code_language(language: &str) -> &str {
    match language {
        "sh" | "shell" | "bash" | "zsh" => "bash",
        "ts" | "typescript" => "typescript",
        "js" | "javascript" => "javascript",
        "yaml" | "yml" | "dockercompose" => "yaml",
        "json" | "jsonc" => "json",
        "py" | "python" => "python",
        other => other,
    }
}

/// The `YouTube` video id of a watch, embed or share URL.
#[must_use]
pub fn youtube_video_id(url: &str) -> Option<&str> {
    let start = ["youtube.com/watch?v=", "youtube.com/embed/", "youtu.be/"]
        .iter()
        .find_map(|marker| url.find(marker).map(|at| at + marker.len()))?;
    let rest = &url[start..];
    let end = rest
        .find(|c: char| matches!(c, '&' | '?' | '/') || c.is_whitespace())
        .unwrap_or(rest.len());
    (end > 0).then(|| &rest[..end])
}

/// One `format: content` notes block.
fn format_block(format: &str, content: &YamlOwned) -> Block {
    let format = format.trim().to_lowercase();
    let text = as_str(content).map_or_else(
        || serde_json::to_string_pretty(&to_json(content)).unwrap_or_default(),
        str::to_owned,
    );
    match format.as_str() {
        "md" | "markdown" => Block::Text(text),
        "mermaid" => Block::Image {
            title: "Mermaid Diagram",
            source: format!(
                "https://mermaid.ink/img/{}?type=png&bgColor=fff",
                URL_SAFE_NO_PAD.encode(&text)
            ),
        },
        "svg" => Block::Image {
            title: "SVG Image",
            source: format!("data:image/svg+xml;base64,{}", STANDARD.encode(&text)),
        },
        "img" => Block::Image {
            title: "Image",
            source: text,
        },
        language => Block::Code {
            language: code_language(language).to_owned(),
            content: text,
        },
    }
}

fn map_blocks(node: &YamlOwned) -> Vec<Block> {
    match node {
        YamlOwned::Mapping(pairs) => pairs
            .iter()
            .map(|(k, v)| format_block(&crate::yaml::scalar_text(k).unwrap_or_default(), v))
            .collect(),
        _ => Vec::new(),
    }
}

/// The notes as blocks: a string, a list of strings and `format: content` maps, or one map.
fn notes_blocks(notes: &YamlOwned) -> Vec<Block> {
    match notes {
        YamlOwned::Sequence(items) => items
            .iter()
            .flat_map(|item| match as_str(item) {
                Some(text) => vec![Block::Text(text.to_owned())],
                None => map_blocks(item),
            })
            .collect(),
        YamlOwned::Mapping(_) => map_blocks(notes),
        _ => as_str(notes)
            .map(|text| vec![Block::Text(text.to_owned())])
            .unwrap_or_default(),
    }
}

/// Whether JavaScript would treat the notes as truthy (`if (entry.notes)`).
fn has_notes(notes: Option<&YamlOwned>) -> bool {
    notes.is_some_and(|n| as_str(n).is_none_or(|s| !s.is_empty()))
}

/// Compiles an entry's notes, description, links and source into Markdown.
#[must_use]
pub fn build_entry_markdown(entry: &Entry) -> String {
    let entry_type = entry.entry_type.to_lowercase();
    let mut blocks = Vec::new();

    if entry_type.contains("bookmark")
        && let Some(id) = youtube_video_id(&entry.primary_content)
    {
        blocks.push(Block::Image {
            title: "YouTube Thumbnail",
            source: format!("https://img.youtube.com/vi/{id}/maxresdefault.jpg"),
        });
    }
    if entry_type.contains("command") {
        blocks.push(Block::Code {
            language: "bash".into(),
            content: entry.primary_content.clone(),
        });
    }
    if let Some(description) = entry.description.as_deref().map(str::trim).filter(|d| !d.is_empty()) {
        blocks.push(Block::Blockquote(description.to_owned()));
    }
    if has_notes(entry.notes.as_ref()) {
        blocks.extend(entry.notes.as_ref().map(notes_blocks).unwrap_or_default());
    }
    if !entry.links.is_empty() {
        blocks.push(Block::H3("LINKS"));
        blocks.push(Block::List(
            entry
                .links
                .iter()
                .map(|l| {
                    format!(
                        "[{}]({})",
                        l.title.as_deref().filter(|t| !t.is_empty()).unwrap_or(&l.url),
                        l.url
                    )
                })
                .collect(),
        ));
    }
    blocks.push(Block::Text(format!("\n\n*Source: `{}`*", entry.source_rel_path)));

    blocks.iter().map(render).collect::<Vec<_>>().join("\n")
}

/// `json2md` of one block. Every typed block ends with a newline; a text block does not.
fn render(block: &Block) -> String {
    match block {
        Block::Text(text) => text.clone(),
        Block::Image { title, source } => format!("![]({source} \"{title}\")\n"),
        Block::Code { language, content } => format!("```{language}\n{content}\n```\n"),
        Block::Blockquote(text) => format!("{}\n", prefix_lines(text, "> ")),
        Block::H3(text) => format!("### {text}\n"),
        Block::List(items) => {
            let mut body = String::new();
            for item in items {
                body.push_str("\n - ");
                body.push_str(&text_format(&indent_rest(item, 4)));
            }
            body.push('\n');
            body
        }
    }
}

/// `indento(text, 1, prefix)`: `text.replace(/^/gm, prefix)`, a prefix at the start and after
/// every JavaScript line terminator.
fn prefix_lines(text: &str, prefix: &str) -> String {
    let mut out = String::from(prefix);
    for c in text.chars() {
        out.push(c);
        if matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}') {
            out.push_str(prefix);
        }
    }
    out
}

/// `json2md`'s `indent(content, spaces, true)`: every line but the first indented.
fn indent_rest(text: &str, spaces: usize) -> String {
    let pad = " ".repeat(spaces);
    let mut lines = text.split('\n');
    let first = lines.next().unwrap_or_default().to_owned();
    lines.fold(first, |acc, line| format!("{acc}\n{pad}{line}"))
}

/// `json2md`'s `parseTextFormat`: HTML emphasis tags as Markdown markers.
fn text_format(text: &str) -> String {
    let mut out = text.to_owned();
    for (tag, marker) in [
        ("strong", "**"),
        ("bold", "**"),
        ("em", "*"),
        ("italic", "*"),
        ("u", "_"),
        ("strike", "~~"),
    ] {
        out = replace_tag(&out, tag, marker);
    }
    out
}

/// Replaces `<tag>` and `</tag>`, in any case, with `marker`.
fn replace_tag(text: &str, tag: &str, marker: &str) -> String {
    let lower = text.to_ascii_lowercase();
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < text.len() {
        let rest = &lower[i..];
        let close = rest.starts_with("</");
        let name_at = if close { 2 } else { 1 };
        if rest.starts_with('<') && rest[name_at..].starts_with(tag) && rest[name_at + tag.len()..].starts_with('>') {
            out.push_str(marker);
            i += name_at + tag.len() + 1;
        } else {
            let c = text[i..].chars().next().unwrap_or_default();
            out.push(c);
            i += c.len_utf8();
        }
    }
    out
}
````

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p kb-domain markdown && cargo clippy -p kb-domain --all-targets -- -D warnings`

Expected: 4 passed (plus any tests of earlier modules the filter matches); clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-domain/src/lib.rs crates/kb-domain/src/markdown.rs crates/kb-domain/Cargo.toml Cargo.lock
git commit -m "feat(domain): Compile notes to Markdown

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: The index row

**Files:**

- Create: `crates/kb-domain/src/row.rs`
- Modify: `crates/kb-domain/src/lib.rs`

`row_to_entry` re-reads tags and task columns from `raw_yaml` with the writer's own rules, as `indexRowToEntry` does.

- [ ] **Step 1: Register the module and write its tests**

Add `pub mod row;` to `crates/kb-domain/src/lib.rs`, keeping the `pub mod` lines sorted. Create
`crates/kb-domain/src/row.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::entry::normalize_entry;

    fn entry(entry_type: &str, source: &str) -> Entry {
        let raw = yaml::load(source).unwrap().unwrap();
        normalize_entry("/root/f.yml", "f.yml", entry_type, "k", &raw)
    }

    #[test]
    fn indexes_the_plain_text_of_every_notes_shape() {
        let notes = |source| searchable_notes_text(entry("notes", source).notes.as_ref());
        assert_eq!(notes("notes: ' plain '\n"), "plain");
        assert_eq!(notes("notes: [' one ', {md: ' two '}, 3]\n"), "one two");
        assert_eq!(notes("notes: {md: a, sh: b}\n"), "a b");
        assert_eq!(notes("title: none\n"), "");
    }

    #[test]
    fn writes_links_as_the_typescript_engine_does() {
        let row = entry_to_row(&entry(
            "bookmarks",
            "links: [https://a.example, {Guide: https://b.example}]\n",
        ));
        assert_eq!(
            row.links_json,
            r#"[{"url":"https://a.example"},{"title":"Guide","url":"https://b.example"}]"#
        );
    }

    #[test]
    fn rebuilds_tags_and_task_columns_from_the_row() {
        let original = entry("tasks", "tags: [Rust]\nstatus: todo\npriority: high\nnotes: text\n");
        let rebuilt = row_to_entry(&entry_to_row(&original));
        assert_eq!(rebuilt.tags, ["rust"]);
        assert_eq!(rebuilt.task_status.as_deref(), Some("todo"));
        assert_eq!(rebuilt.task_priority.as_deref(), Some("high"));
        assert_eq!(rebuilt.links, original.links);
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-domain row`

Expected: compilation fails — `error[E0425]: cannot find function `searchable_notes_text``.

- [ ] **Step 3: Write the implementation above the tests**

Insert at the top of `crates/kb-domain/src/row.rs`, before `#[cfg(test)]`:

```rust
//! The index row: an entry's SQLite projection, and the way back.

use saphyr::YamlOwned;
use serde::{Deserialize, Serialize};

use crate::entry::{Entry, EntryLink, normalize_tags, raw_string};
use crate::yaml::{self, as_str, field, is_null};

/// One row of the `entries` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IndexRow {
    /// The entry id.
    pub id: String,
    /// The display title.
    pub title: String,
    /// The description, or empty.
    pub description: String,
    /// The entry type.
    #[serde(rename = "type")]
    pub entry_type: String,
    /// The notes' plain text, for the full-text index.
    pub notes: String,
    /// The notes compiled to Markdown.
    pub notes_markdown: String,
    /// What the main action opens or copies.
    pub primary_content: String,
    /// The links as JSON.
    pub links_json: String,
    /// The absolute source path.
    pub source_file: String,
    /// The source path relative to the sources directory.
    pub source_rel_path: String,
    /// The entry's map as YAML.
    pub raw_yaml: String,
}

fn item_strings(item: &YamlOwned) -> Vec<String> {
    match item {
        YamlOwned::Mapping(pairs) => pairs
            .iter()
            .filter_map(|(_, v)| as_str(v))
            .map(|s| s.trim().to_owned())
            .collect(),
        _ => as_str(item).map(|s| vec![s.trim().to_owned()]).unwrap_or_default(),
    }
}

/// The notes' text without Markdown, so the full-text index scores words, not syntax.
#[must_use]
pub fn searchable_notes_text(notes: Option<&YamlOwned>) -> String {
    match notes {
        None => String::new(),
        Some(YamlOwned::Sequence(items)) => items.iter().flat_map(item_strings).collect::<Vec<_>>().join(" "),
        Some(node) => item_strings(node).join(" "),
    }
}

/// Projects an entry into its row.
#[must_use]
pub fn entry_to_row(entry: &Entry) -> IndexRow {
    IndexRow {
        id: entry.id.clone(),
        title: entry.title.clone(),
        description: entry.description.clone().unwrap_or_default(),
        entry_type: entry.entry_type.clone(),
        notes: searchable_notes_text(entry.notes.as_ref()),
        notes_markdown: entry.notes_markdown.clone(),
        primary_content: entry.primary_content.clone(),
        // Serializing owned strings cannot fail.
        links_json: serde_json::to_string(&entry.links).unwrap_or_else(|_| "[]".into()),
        source_file: entry.source_file.clone(),
        source_rel_path: entry.source_rel_path.clone(),
        raw_yaml: entry.raw_yaml.clone(),
    }
}

/// Rebuilds the entry a row was projected from. Tags and task columns are re-read from
/// `raw_yaml` with the writer's own rules, so a row renders as its entry did.
#[must_use]
pub fn row_to_entry(row: &IndexRow) -> Entry {
    let raw = yaml::load(&row.raw_yaml).ok().flatten().unwrap_or(YamlOwned::BadValue);
    let tags = field(&raw, "tags")
        .filter(|n| !is_null(n))
        .or_else(|| field(&raw, "tag").filter(|n| !is_null(n)));
    let is_task = row.entry_type.to_lowercase().contains("task");
    Entry {
        id: row.id.clone(),
        title: row.title.clone(),
        description: Some(row.description.clone()).filter(|d| !d.is_empty()),
        entry_type: row.entry_type.clone(),
        tags: normalize_tags(tags),
        notes: (!row.notes.is_empty()).then(|| YamlOwned::Value(saphyr::ScalarOwned::String(row.notes.clone()))),
        notes_markdown: if row.notes_markdown.is_empty() {
            row.notes.clone()
        } else {
            row.notes_markdown.clone()
        },
        links: serde_json::from_str::<Vec<EntryLink>>(&row.links_json).unwrap_or_default(),
        source_file: row.source_file.clone(),
        source_rel_path: row.source_rel_path.clone(),
        primary_content: row.primary_content.clone(),
        task_status: if is_task { raw_string(&raw, "status") } else { None },
        task_priority: if is_task { raw_string(&raw, "priority") } else { None },
        raw_yaml: row.raw_yaml.clone(),
    }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p kb-domain row && cargo clippy -p kb-domain --all-targets -- -D warnings`

Expected: 3 passed (plus any tests of earlier modules the filter matches); clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-domain/src/lib.rs crates/kb-domain/src/row.rs
git commit -m "feat(domain): Project entries into index rows and back

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: The FTS5 query

**Files:**

- Create: `crates/kb-domain/src/query.rs`
- Modify: `crates/kb-domain/src/lib.rs`

- [ ] **Step 1: Register the module and write its tests**

Add `pub mod query;` to `crates/kb-domain/src/lib.rs`, keeping the `pub mod` lines sorted. Create
`crates/kb-domain/src/query.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_control_characters_and_collapses_whitespace() {
        assert_eq!(sanitize_query_text("  a\"b'c*d^e:f (g) {h} [i]  "), "a b c d e f g h i");
    }

    #[test]
    fn builds_prefix_terms() {
        assert_eq!(fts_prefix_query("docker run"), "\"docker\"* \"run\"*");
        assert_eq!(fts_prefix_query(" :* "), "");
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-domain query`

Expected: compilation fails — `error[E0425]: cannot find function `sanitize_query_text``.

- [ ] **Step 3: Write the implementation above the tests**

Insert at the top of `crates/kb-domain/src/query.rs`, before `#[cfg(test)]`:

```rust
//! The search text as an FTS5 query.

/// Replaces FTS5 control characters with spaces and collapses whitespace.
#[must_use]
pub fn sanitize_query_text(input: &str) -> String {
    let spaced: String = input
        .chars()
        .map(|c| {
            if matches!(c, '"' | '\'' | '*' | '^' | ':' | '(' | ')' | '{' | '}' | '[' | ']') {
                ' '
            } else {
                c
            }
        })
        .collect();
    spaced.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The search words.
#[must_use]
pub fn tokenize_query(text: &str) -> Vec<String> {
    sanitize_query_text(text)
        .split(' ')
        .filter(|t| !t.is_empty())
        .map(str::to_owned)
        .collect()
}

/// Each word as a quoted prefix term: `docker run` → `"docker"* "run"*`; empty when no words.
#[must_use]
pub fn fts_prefix_query(text: &str) -> String {
    tokenize_query(text)
        .iter()
        .map(|t| format!("\"{t}\"*"))
        .collect::<Vec<_>>()
        .join(" ")
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p kb-domain query && cargo clippy -p kb-domain --all-targets -- -D warnings`

Expected: 2 passed (plus any tests of earlier modules the filter matches); clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-domain/src/lib.rs crates/kb-domain/src/query.rs
git commit -m "feat(domain): Turn search text into an FTS5 query

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Search

**Files:**

- Create: `crates/kb-domain/src/search.rs`
- Modify: `crates/kb-domain/src/lib.rs`, `crates/kb-domain/Cargo.toml`

`CROSS JOIN` pins the FTS match as the outer loop, as in kb after `8aa510c`.

- [ ] **Step 1: Register the module and write its tests**

Add to `[dependencies]` in `crates/kb-domain/Cargo.toml` (create the table if it is not there yet):

```toml
rusqlite.workspace = true
```

Add `pub mod search;` to `crates/kb-domain/src/lib.rs`, keeping the `pub mod` lines sorted. Create
`crates/kb-domain/src/search.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn query(text: &str, types: &[&str], tags: &[&str]) -> SearchQuery {
        SearchQuery {
            text: text.into(),
            filter: FilterState {
                types: types.iter().map(|s| (*s).into()).collect(),
                tags: tags.iter().map(|s| (*s).into()).collect(),
            },
            limit: 25,
            offset: 50,
        }
    }

    #[test]
    fn orders_by_rank_from_the_fts_match_with_text() {
        let sql = build_search_sql(&query("docker", &["commands"], &["infra"]));
        assert!(
            sql.sql
                .contains("FROM entries_fts(?) fts CROSS JOIN entries e ON e.rowid = fts.rowid")
        );
        assert!(
            sql.sql.contains(
                "WHERE e.type IN (?) AND EXISTS (SELECT 1 FROM entry_tags WHERE entry_id = e.id AND tag = ?)"
            )
        );
        assert!(sql.sql.ends_with("ORDER BY fts.rank LIMIT ? OFFSET ?"));
        assert_eq!(sql.params.len(), 5);
    }

    #[test]
    fn orders_by_title_without_text() {
        let sql = build_search_sql(&query("  ", &[], &[]));
        assert_eq!(
            sql.sql,
            "SELECT e.* FROM entries e ORDER BY e.title ASC LIMIT ? OFFSET ?"
        );
        assert_eq!(sql.params.len(), 2);
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-domain search`

Expected: compilation fails — `error[E0422]: cannot find struct, variant or union type `SearchQuery``.

- [ ] **Step 3: Write the implementation above the tests**

Insert at the top of `crates/kb-domain/src/search.rs`, before `#[cfg(test)]`:

```rust
//! Searching the index: one page of entries for a query and a filter.

use rusqlite::{Connection, params_from_iter};

use crate::query::fts_prefix_query;
use crate::row::IndexRow;

/// Entries per page, as the Raycast list shows them.
pub const PAGE_SIZE: usize = 50;

/// The entry types and tags a query is narrowed to: any selected type, every selected tag.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct FilterState {
    /// Selected entry types.
    pub types: Vec<String>,
    /// Selected tags.
    pub tags: Vec<String>,
}

/// The search text, filter and page window.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchQuery {
    /// What the user typed.
    pub text: String,
    /// The filter, if any.
    pub filter: FilterState,
    /// Page size.
    pub limit: usize,
    /// Rows to skip.
    pub offset: usize,
}

/// A statement and its parameters.
#[derive(Debug, Clone, PartialEq)]
pub struct SearchSql {
    /// The SQL.
    pub sql: String,
    /// Its parameters, in order.
    pub params: Vec<rusqlite::types::Value>,
}

/// The statement the TypeScript engine runs: FTS rank order with text, title order without.
/// `CROSS JOIN` pins the FTS match as the outer loop on every SQLite version.
#[must_use]
pub fn build_search_sql(query: &SearchQuery) -> SearchSql {
    use rusqlite::types::Value;
    let fts = fts_prefix_query(&query.text);
    let mut conditions = Vec::new();
    let mut params: Vec<Value> = Vec::new();
    if !fts.is_empty() {
        params.push(Value::Text(fts.clone()));
    }
    if !query.filter.types.is_empty() {
        conditions.push(format!(
            "e.type IN ({})",
            vec!["?"; query.filter.types.len()].join(", ")
        ));
        params.extend(query.filter.types.iter().cloned().map(Value::Text));
    }
    for tag in &query.filter.tags {
        conditions.push("EXISTS (SELECT 1 FROM entry_tags WHERE entry_id = e.id AND tag = ?)".to_owned());
        params.push(Value::Text(tag.clone()));
    }
    let limit = i64::try_from(query.limit).unwrap_or(i64::MAX);
    let offset = i64::try_from(query.offset).unwrap_or(i64::MAX);
    params.extend([Value::Integer(limit), Value::Integer(offset)]);
    let filter = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };
    let sql = if fts.is_empty() {
        format!("SELECT e.* FROM entries e{filter} ORDER BY e.title ASC LIMIT ? OFFSET ?")
    } else {
        format!(
            "SELECT e.* FROM entries_fts(?) fts CROSS JOIN entries e ON e.rowid = fts.rowid{filter} ORDER BY fts.rank LIMIT ? OFFSET ?"
        )
    };
    SearchSql { sql, params }
}

/// One page of rows for a query.
///
/// # Errors
///
/// An SQLite error.
pub fn search(connection: &Connection, query: &SearchQuery) -> rusqlite::Result<Vec<IndexRow>> {
    let SearchSql { sql, params } = build_search_sql(query);
    let mut statement = connection.prepare_cached(&sql)?;
    let rows = statement.query_map(params_from_iter(params), |row| {
        Ok(IndexRow {
            id: row.get("id")?,
            title: row.get("title")?,
            description: row.get("description")?,
            entry_type: row.get("type")?,
            notes: row.get("notes")?,
            notes_markdown: row.get("notes_markdown")?,
            primary_content: row.get("primary_content")?,
            links_json: row.get("links_json")?,
            source_file: row.get("source_file")?,
            source_rel_path: row.get("source_rel_path")?,
            raw_yaml: row.get("raw_yaml")?,
        })
    })?;
    rows.collect()
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p kb-domain search && cargo clippy -p kb-domain --all-targets -- -D warnings`

Expected: 2 passed (plus any tests of earlier modules the filter matches); clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-domain/src/lib.rs crates/kb-domain/src/search.rs crates/kb-domain/Cargo.toml Cargo.lock
git commit -m "feat(domain): Search one page of the index

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Source files

**Files:**

- Create: `crates/kb-domain/src/source.rs`
- Modify: `crates/kb-domain/src/lib.rs`, `crates/kb-domain/Cargo.toml`

Discovery follows symlinks, skips dot-names and sorts by path, as `findSourceFiles` does. A type block that is a list fails the whole file. `scan_knowledge_base` is `scanKnowledgeBase`, used by the bench.

- [ ] **Step 1: Register the module and write its tests**

Add to `[dependencies]` in `crates/kb-domain/Cargo.toml` (create the table if it is not there yet):

```toml
walkdir.workspace = true
```

Add to `[dev-dependencies]` (create the table):

```toml
tempfile.workspace = true
```

Add `pub mod source;` to `crates/kb-domain/src/lib.rs`, keeping the `pub mod` lines sorted. Create
`crates/kb-domain/src/source.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn tree(files: &[(&str, &str)]) -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap();
        for (path, content) in files {
            let path = root.path().join(path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, content).unwrap();
        }
        root
    }

    #[test]
    fn finds_yaml_files_sorted_skipping_dot_names() {
        let root = tree(&[
            ("b.yml", ""),
            ("a/c.yaml", ""),
            ("a/d.txt", ""),
            (".hidden/e.yml", ""),
            (".f.yml", ""),
        ]);
        let found: Vec<String> = find_source_files(root.path())
            .unwrap()
            .iter()
            .map(|p| p.strip_prefix(root.path()).unwrap().to_string_lossy().into_owned())
            .collect();
        assert_eq!(found, ["a/c.yaml", "b.yml"]);
    }

    #[test]
    fn fails_when_the_root_cannot_be_read() {
        assert!(find_source_files(Path::new("/no/such/sources")).is_err());
    }

    #[test]
    fn separates_map_entries_from_skipped_ones() {
        let root = tree(&[("f.yml", "commands:\n  ls: {desc: list}\n  pwd: just a string\nempty:\n")]);
        let parsed = parse_source_file(&root.path().join("f.yml"));
        assert_eq!(parsed.records.len(), 1);
        assert_eq!(
            parsed.skipped,
            [SkippedEntry {
                entry_type: "commands".into(),
                key: "pwd".into()
            }]
        );
        assert_eq!(parsed.error, None);
    }

    #[test]
    fn rejects_a_type_block_that_is_a_list() {
        let root = tree(&[("f.yml", "commands:\n  - a\n")]);
        let error = parse_source_file(&root.path().join("f.yml")).error.unwrap();
        assert_eq!(
            error.message,
            "type block \"commands\" is a list; it must be a map of keys to entries"
        );
        assert_eq!((error.line, error.column), (None, None));
    }

    #[test]
    fn scans_entries_and_collects_failed_files() {
        let root = tree(&[("ok.yml", "notes:\n  a: {title: A}\n"), ("bad.yml", "a: [\n")]);
        let scan = scan_knowledge_base(root.path()).unwrap();
        assert_eq!(
            scan.entries.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(),
            ["ok.yml#notes#a"]
        );
        assert_eq!(scan.errors.len(), 1);
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-domain source`

Expected: compilation fails — `error[E0425]: cannot find function `find_source_files``.

- [ ] **Step 3: Write the implementation above the tests**

Insert at the top of `crates/kb-domain/src/source.rs`, before `#[cfg(test)]`:

```rust
//! Source files: finding them and reading their entries.

use std::fs;
use std::path::{Path, PathBuf};

use saphyr::YamlOwned;
use walkdir::WalkDir;

use crate::yaml::{self, scalar_text};

/// One entry as its source wrote it, before normalization.
#[derive(Debug, Clone, PartialEq)]
pub struct RawEntryRecord {
    /// The entry type: the top-level key.
    pub entry_type: String,
    /// The entry key.
    pub key: String,
    /// The entry's map.
    pub raw: YamlOwned,
}

/// An entry whose value is not a map, so it cannot be indexed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkippedEntry {
    /// The entry type.
    pub entry_type: String,
    /// The entry key.
    pub key: String,
}

/// Why a source file could not be read, and where.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceError {
    /// The file.
    pub file_path: String,
    /// What went wrong.
    pub message: String,
    /// 1-based line, when known.
    pub line: Option<usize>,
    /// 1-based column, when known.
    pub column: Option<usize>,
}

/// What one source file yields.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ParsedSourceFile {
    /// Entries that are maps.
    pub records: Vec<RawEntryRecord>,
    /// Entries that are not.
    pub skipped: Vec<SkippedEntry>,
    /// Set when the file failed; `records` and `skipped` are then empty.
    pub error: Option<SourceError>,
}

/// Every `.yml` and `.yaml` file under `sources_dir`, recursively, following symlinks, skipping
/// names that start with a dot, sorted by path.
///
/// # Errors
///
/// The root cannot be read: a sync must fail before it opens a transaction, or zero files would
/// commit as an empty index.
pub fn find_source_files(sources_dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    fs::read_dir(sources_dir)?;
    let mut files: Vec<PathBuf> = WalkDir::new(sources_dir)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.'))
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .map(walkdir::DirEntry::into_path)
        .filter(|p| p.extension().is_some_and(|x| x == "yml" || x == "yaml"))
        .collect();
    files.sort();
    Ok(files)
}

/// Reads one source file's entries; a syntax error, or a type block that is a list, fails the
/// whole file.
#[must_use]
pub fn parse_source_file(file_path: &Path) -> ParsedSourceFile {
    let path = file_path.to_string_lossy().into_owned();
    let failed = |message: String, line, column| ParsedSourceFile {
        error: Some(SourceError {
            file_path: path.clone(),
            message,
            line,
            column,
        }),
        ..ParsedSourceFile::default()
    };
    let source = match fs::read_to_string(file_path) {
        Ok(source) => source,
        Err(error) => return failed(error.to_string(), None, None),
    };
    let document = match yaml::load(&source) {
        Ok(Some(YamlOwned::Mapping(types))) => types,
        Ok(_) => return ParsedSourceFile::default(),
        Err(error) => return failed(error.message, Some(error.line), Some(error.column)),
    };

    let mut parsed = ParsedSourceFile::default();
    let mut rejections = Vec::new();
    for (type_key, entries) in &document {
        let entry_type = scalar_text(type_key).unwrap_or_default();
        match entries {
            // A list would key its entries by position, so their ids would change on reorder.
            YamlOwned::Sequence(_) => {
                rejections.push(format!(
                    "type block \"{entry_type}\" is a list; it must be a map of keys to entries"
                ));
            }
            YamlOwned::Mapping(entries) => {
                for (key, raw) in entries {
                    let key = scalar_text(key).unwrap_or_default();
                    if matches!(raw, YamlOwned::Mapping(_)) {
                        parsed.records.push(RawEntryRecord {
                            entry_type: entry_type.clone(),
                            key,
                            raw: raw.clone(),
                        });
                    } else {
                        parsed.skipped.push(SkippedEntry {
                            entry_type: entry_type.clone(),
                            key,
                        });
                    }
                }
            }
            _ => {}
        }
    }
    if rejections.is_empty() {
        parsed
    } else {
        failed(rejections.join("; "), None, None)
    }
}

/// Every entry under `sources_dir`, normalized, and the files that failed.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ScanResult {
    /// The entries, in file and source order; `notes_markdown` is not compiled.
    pub entries: Vec<crate::entry::Entry>,
    /// One error per failed file.
    pub errors: Vec<SourceError>,
}

/// Reads and normalizes every entry under `sources_dir`, without touching the index.
///
/// # Errors
///
/// The sources directory cannot be read.
pub fn scan_knowledge_base(sources_dir: &Path) -> std::io::Result<ScanResult> {
    let mut result = ScanResult::default();
    for file in find_source_files(sources_dir)? {
        let file_path = file.to_string_lossy().into_owned();
        let rel_path = file
            .strip_prefix(sources_dir)
            .unwrap_or(&file)
            .to_string_lossy()
            .into_owned();
        let parsed = parse_source_file(&file);
        if let Some(error) = parsed.error {
            result.errors.push(error);
            continue;
        }
        for record in &parsed.records {
            result.entries.push(crate::entry::normalize_entry(
                &file_path,
                &rel_path,
                &record.entry_type,
                &record.key,
                &record.raw,
            ));
        }
    }
    Ok(result)
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p kb-domain source && cargo clippy -p kb-domain --all-targets -- -D warnings`

Expected: 5 passed (plus any tests of earlier modules the filter matches); clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-domain/src/lib.rs crates/kb-domain/src/source.rs crates/kb-domain/Cargo.toml Cargo.lock
git commit -m "feat(domain): Find, read and scan source files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: The sync report

**Files:**

- Create: `crates/kb-domain/src/report.rs`
- Modify: `crates/kb-domain/src/lib.rs`, `crates/kb-domain/Cargo.toml`

- [ ] **Step 1: Register the module and write its tests**

Add to `[dependencies]` in `crates/kb-domain/Cargo.toml` (create the table if it is not there yet):

```toml
indexmap.workspace = true
```

Add `pub mod report;` to `crates/kb-domain/src/lib.rs`, keeping the `pub mod` lines sorted. Create
`crates/kb-domain/src/report.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::SkippedEntry;

    #[test]
    fn numbers_and_marks_the_lines_around_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("f.yml");
        fs::write(
            &path,
            (1..=12).map(|n| format!("line {n}")).collect::<Vec<_>>().join("\n"),
        )
        .unwrap();
        let text = excerpt(&path.to_string_lossy(), 10, 2);
        assert_eq!(
            text,
            "   8 | line 8\n   9 | line 9\n> 10 | line 10\n  11 | line 11\n  12 | line 12"
        );
        assert_eq!(excerpt(&path.to_string_lossy(), 99, 2), "");
    }

    #[test]
    fn counts_types_and_flags_skipped_and_empty_files() {
        let skipped = ParsedSourceFile {
            skipped: vec![SkippedEntry {
                entry_type: "t".into(),
                key: "k".into(),
            }],
            ..ParsedSourceFile::default()
        };
        assert_eq!(
            file_report("/f", "f", &skipped).issues,
            [FileIssue::SkippedEntry {
                entry_type: "t".into(),
                key: "k".into()
            }]
        );
        assert_eq!(
            file_report("/f", "f", &ParsedSourceFile::default()).issues,
            [FileIssue::Empty]
        );
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-domain report`

Expected: compilation fails — `error[E0425]: cannot find function `excerpt``.

- [ ] **Step 3: Write the implementation above the tests**

Insert at the top of `crates/kb-domain/src/report.rs`, before `#[cfg(test)]`:

```rust
//! What a sync says about each source file.

use std::fs;

use indexmap::IndexMap;

use crate::source::{ParsedSourceFile, SourceError};

/// Something worth telling the user about a file that otherwise indexed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileIssue {
    /// An entry that is not a map.
    SkippedEntry {
        /// Its type.
        entry_type: String,
        /// Its key.
        key: String,
    },
    /// A file with no entries at all.
    Empty,
}

/// One source file's outcome.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileReport {
    /// Relative to the sources directory.
    pub rel_path: String,
    /// Absolute.
    pub file_path: String,
    /// Entries indexed.
    pub entries: usize,
    /// Entries per type, in order of first appearance.
    pub types: IndexMap<String, usize>,
    /// Set when the file failed.
    pub error: Option<SourceError>,
    /// The lines around the error, when it has a line.
    pub excerpt: Option<String>,
    /// Skipped entries, or that the file is empty.
    pub issues: Vec<FileIssue>,
}

/// The report for one parsed file.
#[must_use]
pub fn file_report(file_path: &str, rel_path: &str, parsed: &ParsedSourceFile) -> FileReport {
    if let Some(error) = &parsed.error {
        return FileReport {
            rel_path: rel_path.to_owned(),
            file_path: file_path.to_owned(),
            entries: 0,
            types: IndexMap::new(),
            error: Some(error.clone()),
            excerpt: error
                .line
                .map(|line| excerpt(file_path, line, 2))
                .filter(|e| !e.is_empty()),
            issues: Vec::new(),
        };
    }
    let mut types = IndexMap::new();
    for record in &parsed.records {
        *types.entry(record.entry_type.clone()).or_insert(0) += 1;
    }
    let mut issues: Vec<FileIssue> = parsed
        .skipped
        .iter()
        .map(|s| FileIssue::SkippedEntry {
            entry_type: s.entry_type.clone(),
            key: s.key.clone(),
        })
        .collect();
    if parsed.records.is_empty() && issues.is_empty() {
        issues.push(FileIssue::Empty);
    }
    FileReport {
        rel_path: rel_path.to_owned(),
        file_path: file_path.to_owned(),
        entries: parsed.records.len(),
        types,
        error: None,
        excerpt: None,
        issues,
    }
}

/// The lines around `line`, numbered, the line itself marked with `>`.
#[must_use]
pub fn excerpt(file_path: &str, line: usize, radius: usize) -> String {
    let Ok(source) = fs::read_to_string(file_path) else {
        return String::new();
    };
    let lines: Vec<&str> = source.split('\n').collect();
    if line < 1 || line > lines.len() {
        return String::new();
    }
    let from = line.saturating_sub(radius).max(1);
    let to = (line + radius).min(lines.len());
    let width = to.to_string().len();
    (from..=to)
        .map(|n| format!("{} {n:>width$} | {}", if n == line { '>' } else { ' ' }, lines[n - 1]))
        .collect::<Vec<_>>()
        .join("\n")
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p kb-domain report && cargo clippy -p kb-domain --all-targets -- -D warnings`

Expected: 2 passed (plus any tests of earlier modules the filter matches); clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-domain/src/lib.rs crates/kb-domain/src/report.rs crates/kb-domain/Cargo.toml Cargo.lock
git commit -m "feat(domain): Report what a sync found in each file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Sync

**Files:**

- Create: `crates/kb-domain/src/schema.sql`, `crates/kb-domain/src/sync.rs`
- Modify: `crates/kb-domain/src/lib.rs`

The schema is the TypeScript engine's `SCHEMA_DDL`, statement for statement (ADR 0002). The rebuild runs in one
`rusqlite` transaction: a failure or a cancellation drops it and leaves the previous index. A corrupt index file is
replaced; any other failure is returned.

- [ ] **Step 1: Copy the schema**

`crates/kb-domain/src/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  notes TEXT NOT NULL,
  notes_markdown TEXT NOT NULL,
  primary_content TEXT NOT NULL,
  links_json TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_rel_path TEXT NOT NULL,
  raw_yaml TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (entry_id, tag),
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_title ON entries(title);
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag);
-- Virtual table for full-text search with unicode61 tokenizer (ADR 0004)
-- Note on indexed columns: entries_fts indexes notes (clean text tokens) rather than notes_markdown.
-- Indexing raw text tokens avoids indexing markdown syntax punctuation, producing cleaner bm25 relevance scores.
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  title,
  description,
  notes,
  content='entries',
  content_rowid='rowid',
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, title, description, notes)
  VALUES (new.rowid, new.title, new.description, new.notes);
END;

CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, description, notes)
  VALUES ('delete', old.rowid, old.title, old.description, old.notes);
END;

CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, description, notes)
  VALUES ('delete', old.rowid, old.title, old.description, old.notes);
  INSERT INTO entries_fts(rowid, title, description, notes)
  VALUES (new.rowid, new.title, new.description, new.notes);
END;
```

Verify it is the TypeScript schema:

```bash
diff <(sed -n '/SCHEMA_DDL = `/,/`.trim()/p' "$KB_TS_REPO/packages/domain/kb/src/sync.ts" | sed '1d;$d') crates/kb-domain/src/schema.sql && echo same
```

Expected: `same`.

- [ ] **Step 2: Register the module and write its tests**

Add `pub mod sync;` to `lib.rs`. Create `crates/kb-domain/src/sync.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn sources(files: &[(&str, &str)]) -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap();
        for (path, content) in files {
            fs::write(root.path().join(path), content).unwrap();
        }
        root
    }

    fn count(path: &Path, table: &str) -> i64 {
        open_database(path)
            .unwrap()
            .query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn indexes_entries_tags_and_full_text() {
        let root = sources(&[
            ("a.yml", "commands:\n  docker ps: {tags: [docker, Ops]}\n  ls: {}\n"),
            ("b.yml", "x: [\n"),
        ]);
        let db = tempfile::tempdir().unwrap();
        let path = db.path().join("nested/kb.db");
        let mut seen = Vec::new();
        let summary = sync_knowledge_base(root.path(), &path, &AtomicBool::new(false), |p| {
            seen.push(p.files_scanned);
        })
        .unwrap();
        assert_eq!(
            (summary.total_indexed, summary.files_scanned, summary.files_failed),
            (2, 2, 1)
        );
        assert_eq!(seen, [1, 2]);
        assert_eq!(count(&path, "entries"), 2);
        assert_eq!(count(&path, "entry_tags"), 2);
        assert_eq!(count(&path, "entries_fts('\"dock\"*')"), 1);
    }

    #[test]
    fn a_cancelled_sync_leaves_the_previous_index() {
        let root = sources(&[("a.yml", "notes:\n  one: {}\n")]);
        let db = tempfile::tempdir().unwrap();
        let path = db.path().join("kb.db");
        sync_knowledge_base(root.path(), &path, &AtomicBool::new(false), |_| {}).unwrap();
        fs::write(root.path().join("a.yml"), "notes:\n  one: {}\n  two: {}\n").unwrap();
        let result = sync_knowledge_base(root.path(), &path, &AtomicBool::new(true), |_| {});
        assert!(matches!(result, Err(SyncError::Cancelled)));
        assert_eq!(count(&path, "entries"), 1);
    }

    #[test]
    fn replaces_a_corrupt_index() {
        let root = sources(&[("a.yml", "notes:\n  one: {}\n")]);
        let db = tempfile::tempdir().unwrap();
        let path = db.path().join("kb.db");
        fs::write(
            &path,
            "not a database, just text that is long enough to be read as a header....",
        )
        .unwrap();
        let summary = sync_knowledge_base(root.path(), &path, &AtomicBool::new(false), |_| {}).unwrap();
        assert_eq!(summary.total_indexed, 1);
    }
}
```

- [ ] **Step 3: Run them to see them fail**

Run: `cargo test -p kb-domain sync`

Expected: compilation fails — cannot find function `sync_knowledge_base`.

- [ ] **Step 4: Write the implementation above the tests**

```rust
//! Sync: rebuilding the index from the source files.

use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use rusqlite::{Connection, ErrorCode, params};

use crate::entry::{Entry, normalize_entry};
use crate::markdown::build_entry_markdown;
use crate::report::{FileReport, file_report};
use crate::row::entry_to_row;
use crate::source::{SourceError, find_source_files, parse_source_file};

/// The index schema, statement for statement the TypeScript engine's.
pub const SCHEMA_DDL: &str = include_str!("schema.sql");

/// Why a sync stopped.
#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    /// The sources directory could not be read.
    #[error("cannot read the sources directory: {0}")]
    Sources(#[from] std::io::Error),
    /// SQLite failed.
    #[error(transparent)]
    Database(#[from] rusqlite::Error),
    /// The caller cancelled; the index is unchanged.
    #[error("sync cancelled")]
    Cancelled,
}

/// What a sync reports after each file.
#[derive(Debug, Clone, Copy)]
pub struct SyncProgress<'a> {
    /// Files processed so far.
    pub files_scanned: usize,
    /// Files in all.
    pub files_total: usize,
    /// Entries indexed so far.
    pub entries_count: usize,
    /// The file just processed.
    pub file: &'a FileReport,
}

/// A finished sync.
#[derive(Debug, Clone)]
pub struct SyncSummary {
    /// Entries indexed.
    pub total_indexed: usize,
    /// Source files seen.
    pub files_scanned: usize,
    /// Source files that failed.
    pub files_failed: usize,
    /// How long it took.
    pub duration_ms: u128,
    /// One error per failed file.
    pub errors: Vec<SourceError>,
    /// Every file, in processing order.
    pub files: Vec<FileReport>,
}

/// Opens the index with foreign keys on.
///
/// # Errors
///
/// An SQLite error.
pub fn open_database(path: &Path) -> rusqlite::Result<Connection> {
    let connection = Connection::open(path)?;
    connection.pragma_update(None, "foreign_keys", true)?;
    Ok(connection)
}

/// Opens the index with its schema, replacing the file only when SQLite says it is corrupt: the
/// index is derived, so a corrupt one costs nothing to discard; any other failure is returned.
fn open_initialized(path: &Path) -> rusqlite::Result<Connection> {
    let attempt = open_database(path).and_then(|c| c.execute_batch(SCHEMA_DDL).map(|()| c));
    match attempt {
        Err(rusqlite::Error::SqliteFailure(e, _))
            if matches!(e.code, ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase) =>
        {
            for suffix in ["", "-journal", "-wal", "-shm"] {
                let _ = fs::remove_file(format!("{}{suffix}", path.display()));
            }
            let connection = open_database(path)?;
            connection.execute_batch(SCHEMA_DDL)?;
            Ok(connection)
        }
        other => other,
    }
}

/// Rebuilds the index at `database_path` from the source files under `sources_dir`, in one
/// transaction: a failure or a cancellation leaves the previous index as it was.
///
/// # Errors
///
/// The sources directory is unreadable, SQLite fails, or `cancel` was set.
pub fn sync_knowledge_base(
    sources_dir: &Path,
    database_path: &Path,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(SyncProgress<'_>),
) -> Result<SyncSummary, SyncError> {
    let started = Instant::now();
    let files = find_source_files(sources_dir)?;
    if let Some(parent) = database_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut connection = open_initialized(database_path)?;
    let transaction = connection.transaction()?;
    // entry_tags empties through its ON DELETE CASCADE.
    transaction.execute_batch("DELETE FROM entries; INSERT INTO entries_fts(entries_fts) VALUES('delete-all');")?;

    let mut summary = SyncSummary {
        total_indexed: 0,
        files_scanned: files.len(),
        files_failed: 0,
        duration_ms: 0,
        errors: Vec::new(),
        files: Vec::new(),
    };
    {
        let mut insert_entry = transaction.prepare(
            "INSERT INTO entries (id, title, description, type, notes, notes_markdown, primary_content, \
             links_json, source_file, source_rel_path, raw_yaml) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )?;
        let mut insert_tag = transaction.prepare("INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?, ?)")?;
        for (index, file) in files.iter().enumerate() {
            if cancel.load(Ordering::Relaxed) {
                return Err(SyncError::Cancelled);
            }
            let file_path = file.to_string_lossy().into_owned();
            let rel_path = file
                .strip_prefix(sources_dir)
                .unwrap_or(file)
                .to_string_lossy()
                .into_owned();
            let parsed = parse_source_file(file);
            let report = file_report(&file_path, &rel_path, &parsed);
            if let Some(error) = &parsed.error {
                summary.files_failed += 1;
                summary.errors.push(error.clone());
            }
            for record in &parsed.records {
                let mut entry: Entry =
                    normalize_entry(&file_path, &rel_path, &record.entry_type, &record.key, &record.raw);
                entry.notes_markdown = build_entry_markdown(&entry);
                let row = entry_to_row(&entry);
                insert_entry.execute(params![
                    row.id,
                    row.title,
                    row.description,
                    row.entry_type,
                    row.notes,
                    row.notes_markdown,
                    row.primary_content,
                    row.links_json,
                    row.source_file,
                    row.source_rel_path,
                    row.raw_yaml
                ])?;
                for tag in &entry.tags {
                    insert_tag.execute(params![row.id, tag])?;
                }
                summary.total_indexed += 1;
            }
            on_progress(SyncProgress {
                files_scanned: index + 1,
                files_total: files.len(),
                entries_count: summary.total_indexed,
                file: &report,
            });
            summary.files.push(report);
        }
    }
    transaction.commit()?;
    summary.duration_ms = started.elapsed().as_millis();
    Ok(summary)
}
```

- [ ] **Step 5: Run the whole crate**

Run: `cargo test -p kb-domain && cargo clippy --workspace --all-targets -- -D warnings && RUSTDOCFLAGS='-D warnings' cargo doc -p kb-domain --no-deps`

Expected: 30 passed; clippy and rustdoc clean.

- [ ] **Step 6: Commit**

```bash
git add crates/kb-domain/src/lib.rs crates/kb-domain/src/schema.sql crates/kb-domain/src/sync.rs
git commit -m "feat(domain): Rebuild the index from the sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Parity with the TypeScript engine

**Files:**

- Create: `crates/kb-domain/tests/goldens.rs`
- Modify: `mise.toml` (append)

Three tests compare the engine with the goldens Plan 1 wrote:

- **rows** — every column of every row byte for byte, `source_file` made portable with `<root>`, `raw_yaml` by
  value;
- **summary** — counts, per-file types and issues, and a failed file's line, column and excerpt;
- **queries** — per position the same sort key (FTS rank within 1e-9 relative, or title); inside a run of equal
  keys the same ids as a set; a run the page limit cuts is checked by key only, since which tied rows fill the page
  is undefined in both engines.

- [ ] **Step 1: Write the tests**

`crates/kb-domain/tests/goldens.rs`:

```rust
//! The engine against the TypeScript engine's goldens.
//!
//! `KB_CORPUS` and `KB_GOLDENS` name a corpus and its goldens; they default to the committed
//! sample. `mise run parity` points them at the private corpus.

// A test fixture that cannot be built is a failed test: its helpers panic like the tests do.
#![allow(clippy::expect_used, clippy::unwrap_used, clippy::cast_possible_truncation)]

use std::collections::BTreeSet;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use kb_domain::row::IndexRow;
use kb_domain::search::{FilterState, PAGE_SIZE, SearchQuery, search};
use kb_domain::sync::{SyncSummary, open_database, sync_knowledge_base};
use kb_domain::{query::fts_prefix_query, yaml};
use serde::Deserialize;
use serde_json::Value as Json;

fn workspace() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn dir(var: &str, default: &str) -> PathBuf {
    std::env::var(var).map_or_else(|_| workspace().join(default), PathBuf::from)
}

struct Fixture {
    corpus: PathBuf,
    goldens: PathBuf,
    database: tempfile::TempDir,
    summary: SyncSummary,
}

fn fixture() -> Fixture {
    let corpus = dir("KB_CORPUS", "fixtures/sample").canonicalize().expect("corpus");
    let goldens = dir("KB_GOLDENS", "fixtures/sample-goldens");
    let database = tempfile::tempdir().expect("tempdir");
    let summary =
        sync_knowledge_base(&corpus, &database.path().join("kb.db"), &AtomicBool::new(false), |_| {}).expect("sync");
    Fixture {
        corpus,
        goldens,
        database,
        summary,
    }
}

fn portable(text: &str, root: &Path) -> String {
    text.replace(&root.to_string_lossy().into_owned(), "<root>")
}

#[test]
fn rows_match_the_typescript_engine() {
    let f = fixture();
    let connection = open_database(&f.database.path().join("kb.db")).unwrap();
    let mut statement = connection.prepare("SELECT * FROM entries ORDER BY id").unwrap();
    let rows: Vec<IndexRow> = statement
        .query_map([], |r| {
            Ok(IndexRow {
                id: r.get("id")?,
                title: r.get("title")?,
                description: r.get("description")?,
                entry_type: r.get("type")?,
                notes: r.get("notes")?,
                notes_markdown: r.get("notes_markdown")?,
                primary_content: r.get("primary_content")?,
                links_json: r.get("links_json")?,
                source_file: r.get("source_file")?,
                source_rel_path: r.get("source_rel_path")?,
                raw_yaml: r.get("raw_yaml")?,
            })
        })
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    let expected: Vec<IndexRow> = fs::read_to_string(f.goldens.join("rows.jsonl"))
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();

    assert_eq!(rows.len(), expected.len(), "row count");
    let mut mismatches = Vec::new();
    for (actual, golden) in rows.iter().zip(&expected) {
        let mut actual = actual.clone();
        actual.source_file = portable(&actual.source_file, &f.corpus);
        // raw_yaml is compared by value: the port writes it with saphyr's emitter.
        let same_raw = yaml::load(&actual.raw_yaml).ok() == yaml::load(&golden.raw_yaml).ok();
        actual.raw_yaml.clone_from(&golden.raw_yaml);
        if actual != *golden || !same_raw {
            mismatches.push(diff(&actual, golden, same_raw));
        }
    }
    assert!(
        mismatches.is_empty(),
        "{} of {} rows differ:\n{}",
        mismatches.len(),
        rows.len(),
        mismatches.iter().take(5).cloned().collect::<Vec<_>>().join("\n")
    );
}

fn diff(actual: &IndexRow, golden: &IndexRow, same_raw: bool) -> String {
    let a = serde_json::to_value(actual).unwrap();
    let g = serde_json::to_value(golden).unwrap();
    let mut out = format!("{}:", golden.id);
    for (key, value) in g.as_object().unwrap() {
        if a[key] != *value {
            let _ = write!(
                out,
                "
  {key}:
    rust: {:?}
    ts:   {:?}",
                a[key], value
            );
        }
    }
    if !same_raw {
        out += "\n  raw_yaml: values differ";
    }
    out
}

#[test]
fn the_summary_matches_the_typescript_engine() {
    let f = fixture();
    let golden: Json = serde_json::from_str(&fs::read_to_string(f.goldens.join("summary.json")).unwrap()).unwrap();
    let s = &f.summary;
    assert_eq!(s.total_indexed, golden["totalIndexed"].as_u64().unwrap() as usize);
    assert_eq!(s.files_scanned, golden["filesScanned"].as_u64().unwrap() as usize);
    assert_eq!(s.files_failed, golden["filesFailed"].as_u64().unwrap() as usize);
    let files = golden["files"].as_array().unwrap();
    assert_eq!(s.files.len(), files.len());
    for (report, golden) in s.files.iter().zip(files) {
        assert_eq!(report.rel_path, golden["relPath"], "relPath");
        assert_eq!(
            report.entries as u64,
            golden["entries"].as_u64().unwrap(),
            "{}",
            report.rel_path
        );
        let types: Vec<(String, u64)> = report.types.iter().map(|(k, v)| (k.clone(), *v as u64)).collect();
        let golden_types: Vec<(String, u64)> = golden["types"]
            .as_object()
            .unwrap()
            .iter()
            .map(|(k, v)| (k.clone(), v.as_u64().unwrap()))
            .collect();
        assert_eq!(types, golden_types, "{} types", report.rel_path);
        assert_eq!(
            report.issues.len(),
            golden["issues"].as_array().unwrap().len(),
            "{} issues",
            report.rel_path
        );
        // A failed file fails at the same place; the parser's message is its own.
        let position = report.error.as_ref().map(|e| (e.line, e.column));
        let golden_position = golden.get("error").map(|e| {
            (
                e["line"].as_u64().map(|n| n as usize),
                e["column"].as_u64().map(|n| n as usize),
            )
        });
        assert_eq!(position, golden_position, "{} error position", report.rel_path);
        assert_eq!(
            report.excerpt.as_deref(),
            golden.get("excerpt").and_then(Json::as_str),
            "{} excerpt",
            report.rel_path
        );
    }
}

#[derive(Deserialize)]
struct GoldenQuery {
    id: String,
    text: String,
    #[serde(default)]
    types: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    offset: usize,
    results: Vec<GoldenResult>,
}

#[derive(Deserialize)]
struct GoldenResult {
    id: String,
    #[serde(rename = "sortKey")]
    sort_key: Json,
}

fn same_key(a: &Json, b: &Json) -> bool {
    match (a.as_f64(), b.as_f64()) {
        (Some(x), Some(y)) => (x - y).abs() <= 1e-9 * x.abs().max(y.abs()).max(1.0),
        _ => a == b,
    }
}

#[test]
fn queries_return_what_the_typescript_engine_returns() {
    let f = fixture();
    let connection = open_database(&f.database.path().join("kb.db")).unwrap();
    let golden: Vec<GoldenQuery> =
        serde_json::from_str(&fs::read_to_string(f.goldens.join("queries.json")).unwrap()).unwrap();
    for q in golden {
        let rows = search(
            &connection,
            &SearchQuery {
                text: q.text.clone(),
                filter: FilterState {
                    types: q.types,
                    tags: q.tags,
                },
                limit: PAGE_SIZE,
                offset: q.offset,
            },
        )
        .unwrap();
        assert_eq!(rows.len(), q.results.len(), "{}: result count", q.id);
        let fts = fts_prefix_query(&q.text);
        let keys: Vec<Json> = rows
            .iter()
            .map(|row| {
                if fts.is_empty() {
                    Json::String(row.title.clone())
                } else {
                    connection
                        .query_row(
                            "SELECT fts.rank FROM entries_fts(?) fts JOIN entries e ON e.rowid = fts.rowid WHERE e.id = ?",
                            (&fts, &row.id),
                            |r| r.get::<_, f64>(0),
                        )
                        .map(Json::from)
                        .unwrap()
                }
            })
            .collect();
        // Position by position the sort keys agree; inside a run of equal keys the ids agree as
        // a set, except in a run the page limit cuts, whose members are not defined.
        let mut start = 0;
        while start < q.results.len() {
            let mut end = start + 1;
            while end < q.results.len() && same_key(&q.results[end].sort_key, &q.results[start].sort_key) {
                end += 1;
            }
            for (i, (key, golden)) in keys.iter().zip(&q.results).enumerate().take(end).skip(start) {
                assert!(same_key(key, &golden.sort_key), "{}: sort key at {i}", q.id);
            }
            let cut = end == q.results.len() && q.results.len() == PAGE_SIZE;
            if !cut {
                let ours: BTreeSet<&str> = rows[start..end].iter().map(|r| r.id.as_str()).collect();
                let theirs: BTreeSet<&str> = q.results[start..end].iter().map(|r| r.id.as_str()).collect();
                assert_eq!(ours, theirs, "{}: ids at {start}..{end}", q.id);
            }
            start = end;
        }
    }
}
```

- [ ] **Step 2: Run them on the committed sample**

Run: `cargo test -p kb-domain --test goldens`

Expected: 3 passed.

- [ ] **Step 3: Prove they can fail**

In `markdown.rs`, add a space after the closing `*` of the source footer's format string, run
`cargo test -p kb-domain --test goldens rows`, and expect `12 of 12 rows differ`. Undo the change.

- [ ] **Step 4: Add the private parity task**

Append to `mise.toml`:

```toml
[tasks.parity]
description = "Golden parity of kb-domain on the private corpus (local only: the corpus and its goldens are gitignored)"
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  mise run fixtures
  [ -d fixtures/private-goldens ] || mise run goldens private
  KB_CORPUS=fixtures/private KB_GOLDENS=fixtures/private-goldens cargo test -p kb-domain --test goldens
'''
```

Run: `mise run parity`

Expected: 3 passed, in about two seconds, on 4,233 rows and 30 queries.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-domain/tests/goldens.rs mise.toml
git commit -m "test(domain): Prove parity with the TypeScript engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: kb-bench

**Files:**

- Create: `crates/kb-bench/Cargo.toml`, `crates/kb-bench/src/{main,stats,measure,env,query}.rs`
- Modify: `Cargo.toml` (members, `kb-domain` workspace dependency), `mise.toml` (append)

The same cases, warm-ups, sample counts, nearest-rank statistics and JSON as `bench/ts` (D10). One difference is
deliberate and is each app's real path: `search-app` in TypeScript opens a read-only connection per query, as
`@raycast/utils`' `executeSQL` does; in Rust it reuses the connection the app keeps open. Both then turn every row
back into an entry.

- [ ] **Step 1: Add the crate to the workspace**

In `Cargo.toml`: `members = ["crates/kb-domain", "crates/kb-bench"]`, and add to `[workspace.dependencies]`:

```toml
kb-domain = { path = "crates/kb-domain" }
```

`crates/kb-bench/Cargo.toml`:

```toml
[package]
name = "kb-bench"
description = "Tier 1 engine benchmarks of kb-domain, written in the same results schema as bench/ts."
version.workspace = true
edition.workspace = true
rust-version.workspace = true
license.workspace = true
publish.workspace = true
repository.workspace = true

[dependencies]
kb-domain.workspace = true
rusqlite.workspace = true
serde.workspace = true
serde_json.workspace = true
tempfile.workspace = true

[lints]
workspace = true
```

- [ ] **Step 2: Statistics, test first**

`crates/kb-bench/src/stats.rs` — write the tests (below the `#[cfg(test)]` line) first, run
`cargo test -p kb-bench stats` once `main.rs` declares the module (Step 5) and see them fail, then add the
implementation:

```rust
//! Nearest-rank statistics, as `bench/ts/stats.ts` computes them.

use serde::Serialize;

/// A sample set reduced to the figures every result reports.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Stats {
    /// Number of samples.
    pub n: usize,
    /// Smallest sample.
    pub min: u64,
    /// Nearest-rank 50th percentile.
    pub p50: u64,
    /// Nearest-rank 95th percentile.
    pub p95: u64,
    /// Nearest-rank 99th percentile.
    pub p99: u64,
    /// Largest sample.
    pub max: u64,
    /// Arithmetic mean.
    pub mean: f64,
}

/// The smallest sample with at least `p` percent of the set at or below it; no interpolation.
///
/// # Panics
///
/// On an empty sample set.
#[must_use]
pub fn percentile(sorted: &[u64], p: u32) -> u64 {
    assert!(!sorted.is_empty(), "percentile of an empty sample set");
    let rank = (u64::from(p) * sorted.len() as u64).div_ceil(100).max(1);
    sorted[usize::try_from(rank).unwrap_or(usize::MAX).min(sorted.len()) - 1]
}

/// Sorts the samples and reads every figure.
///
/// # Panics
///
/// On an empty sample set.
#[must_use]
pub fn summarize(samples: &[u64]) -> Stats {
    assert!(!samples.is_empty(), "summary of an empty sample set");
    let mut sorted = samples.to_vec();
    sorted.sort_unstable();
    #[allow(clippy::cast_precision_loss)]
    let mean = sorted.iter().map(|&s| s as f64).sum::<f64>() / sorted.len() as f64;
    Stats {
        n: sorted.len(),
        min: sorted[0],
        p50: percentile(&sorted, 50),
        p95: percentile(&sorted, 95),
        p99: percentile(&sorted, 99),
        max: sorted[sorted.len() - 1],
        mean,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_nearest_rank() {
        let hundred: Vec<u64> = (1..=100).collect();
        assert_eq!([50, 95, 99, 100].map(|p| percentile(&hundred, p)), [50, 95, 99, 100]);
        assert_eq!(percentile(&[10, 20, 30], 50), 20);
        assert_eq!(percentile(&[10, 20, 30], 95), 30);
        assert_eq!(percentile(&[7], 1), 7);
    }

    #[test]
    fn summarizes_unsorted_samples() {
        let stats = summarize(&[30, 10, 20, 40]);
        assert_eq!((stats.min, stats.p50, stats.p95, stats.max), (10, 20, 40, 40));
        assert!((stats.mean - 25.0).abs() < f64::EPSILON);
    }

    #[test]
    #[should_panic(expected = "empty")]
    fn rejects_no_samples() {
        let _ = summarize(&[]);
    }
}
```

- [ ] **Step 3: Measurement**

`crates/kb-bench/src/measure.rs`:

```rust
//! Timing one case, as `bench/ts/measure.ts` does.

use std::hint::black_box;
use std::time::Instant;

use serde::Serialize;

use crate::stats::{Stats, summarize};

/// One measured case: every sample in nanoseconds, and their summary.
#[derive(Debug, Clone, Serialize)]
pub struct CaseResult {
    /// The case name.
    pub name: String,
    /// Always `ns`.
    pub unit: &'static str,
    /// Every timed run.
    pub samples: Vec<u64>,
    /// Their summary.
    pub stats: Stats,
}

/// Runs `run` `warmup` times untimed, then `samples` times timed, calling `setup` untimed
/// before every run.
pub fn measure<T>(
    name: &str,
    warmup: usize,
    samples: usize,
    mut setup: impl FnMut(),
    mut run: impl FnMut() -> T,
) -> CaseResult {
    for _ in 0..warmup {
        setup();
        black_box(run());
    }
    let samples: Vec<u64> = (0..samples)
        .map(|_| {
            setup();
            let start = Instant::now();
            black_box(run());
            u64::try_from(start.elapsed().as_nanos()).unwrap_or(u64::MAX)
        })
        .collect();
    let stats = summarize(&samples);
    CaseResult {
        name: name.to_owned(),
        unit: "ns",
        samples,
        stats,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_one_sample_per_timed_run_and_sets_up_every_run() {
        let mut order = Vec::new();
        let calls = std::cell::Cell::new(0);
        let result = measure("count", 1, 2, || order.push('s'), || calls.set(calls.get() + 1));
        assert_eq!(calls.get(), 3);
        assert_eq!(order, ['s', 's', 's']);
        assert_eq!(
            (result.name.as_str(), result.unit, result.samples.len()),
            ("count", "ns", 2)
        );
    }
}
```

- [ ] **Step 4: Environment and queries**

`crates/kb-bench/src/env.rs`:

```rust
//! Where and with what a result was produced, as `bench/ts/env.ts` records it.

use std::process::Command;

use serde::Serialize;

/// The run's environment.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunEnv {
    /// When, in UTC.
    pub date: String,
    /// `machdep.cpu.brand_string`.
    pub cpu: String,
    /// `hw.model`.
    pub model: String,
    /// `macOS <version>`.
    pub os: String,
    /// AC Power or Battery Power.
    pub power: String,
    /// `rust-<rustc version>`.
    pub runtime: String,
    /// The bundled SQLite.
    pub sqlite: String,
    /// Not applicable to the Rust engine; kept for one schema.
    pub ts_repo_commit: String,
    /// This repository, with `-dirty` when it has uncommitted changes.
    pub repo_commit: String,
}

fn read(command: &str, args: &[&str]) -> String {
    Command::new(command)
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map_or_else(
            || "unknown".to_owned(),
            |o| String::from_utf8_lossy(&o.stdout).trim().to_owned(),
        )
}

/// Captures the environment.
#[must_use]
pub fn capture(sqlite: &str) -> RunEnv {
    let batt = read("pmset", &["-g", "batt"]);
    let rustc = read("rustc", &["--version"]);
    RunEnv {
        date: read("date", &["-u", "+%Y-%m-%dT%H:%M:%S.000Z"]),
        cpu: read("sysctl", &["-n", "machdep.cpu.brand_string"]),
        model: read("sysctl", &["-n", "hw.model"]),
        os: format!("macOS {}", read("sw_vers", &["-productVersion"])),
        power: batt.split('\'').nth(1).unwrap_or("unknown").to_owned(),
        runtime: format!("rust-{}", rustc.split_whitespace().nth(1).unwrap_or("unknown")),
        sqlite: sqlite.to_owned(),
        ts_repo_commit: String::new(),
        repo_commit: read("git", &["describe", "--always", "--dirty", "--abbrev=40"]),
    }
}
```

`crates/kb-bench/src/query.rs`:

```rust
//! `fixtures/queries.json`, shared with `bench/ts/query.ts`.

use kb_domain::search::{FilterState, PAGE_SIZE, SearchQuery};
use serde::Deserialize;

/// One benchmark query.
#[derive(Debug, Clone, Deserialize)]
pub struct BenchQuery {
    /// Its id, used in case names.
    pub id: String,
    /// The search text.
    pub text: String,
    /// Selected types.
    #[serde(default)]
    pub types: Vec<String>,
    /// Selected tags.
    #[serde(default)]
    pub tags: Vec<String>,
    /// Rows to skip.
    #[serde(default)]
    pub offset: usize,
}

impl BenchQuery {
    /// The query for one page.
    #[must_use]
    pub fn to_search_query(&self) -> SearchQuery {
        SearchQuery {
            text: self.text.clone(),
            filter: FilterState {
                types: self.types.clone(),
                tags: self.tags.clone(),
            },
            limit: PAGE_SIZE,
            offset: self.offset,
        }
    }
}
```

- [ ] **Step 5: The runner**

`crates/kb-bench/src/main.rs`:

```rust
//! Tier 1: benchmarks `kb-domain` on a corpus and writes one result in the schema `bench/ts`
//! writes, so `xtask report` can compare the two engines case by case.
//!
//! `mise run bench:rs <corpus>` verifies the corpus first and passes its digest.

// A command-line tool reports to the terminal.
#![allow(clippy::print_stdout, clippy::print_stderr)]

mod env;
mod measure;
mod query;
mod stats;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use kb_domain::markdown::build_entry_markdown;
use kb_domain::row::row_to_entry;
use kb_domain::search::search;
use kb_domain::source::scan_knowledge_base;
use kb_domain::sync::{open_database, sync_knowledge_base};
use rusqlite::{Connection, OpenFlags};
use serde_json::json;

use crate::measure::{CaseResult, measure};
use crate::query::BenchQuery;

/// `--name value` from the command line.
fn arg(name: &str) -> Result<String, String> {
    let flag = format!("--{name}");
    let args: Vec<String> = std::env::args().collect();
    args.iter()
        .position(|a| *a == flag)
        .and_then(|i| args.get(i + 1).cloned())
        .ok_or_else(|| format!("missing {flag}"))
}

fn remove_database(path: &Path) {
    for suffix in ["", "-journal", "-wal", "-shm"] {
        let _ = fs::remove_file(format!("{}{suffix}", path.display()));
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let fixtures = PathBuf::from(arg("fixtures")?);
    let corpus = arg("corpus")?;
    let digest = arg("digest")?;
    let files: usize = arg("files")?.parse()?;
    let out = PathBuf::from(arg("out")?);
    let root = fixtures.join(&corpus).canonicalize()?;
    let queries: Vec<BenchQuery> = serde_json::from_str(&fs::read_to_string(fixtures.join("queries.json"))?)?;
    let work = tempfile::tempdir()?;
    let database = work.path().join("kb.db");
    let total = 4 + 2 * queries.len();
    let mut cases: Vec<CaseResult> = Vec::new();
    let mut report = |case: CaseResult| {
        eprintln!(
            "[{}/{total}] {} (p50: {}ms)",
            cases.len() + 1,
            case.name,
            case.stats.p50 / 1_000_000
        );
        cases.push(case);
    };

    let scanned = scan_knowledge_base(&root)?;
    report(measure("scan", 3, 20, || {}, || scan_knowledge_base(&root)));
    report(measure(
        "markdown",
        3,
        20,
        || {},
        || scanned.entries.iter().map(build_entry_markdown).count(),
    ));
    let never = AtomicBool::new(false);
    report(measure(
        "sync-cold",
        2,
        10,
        || remove_database(&database),
        || sync_knowledge_base(&root, &database, &never, |_| {}),
    ));
    report(measure(
        "sync-warm",
        2,
        10,
        || {},
        || sync_knowledge_base(&root, &database, &never, |_| {}),
    ));

    // The app keeps one read-only connection for its whole life; `search-app` is that path,
    // including turning each row back into an entry for the list and the detail pane.
    let connection = Connection::open_with_flags(&database, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let sqlite: String = connection.query_row("SELECT sqlite_version()", [], |r| r.get(0))?;
    for q in &queries {
        let query = q.to_search_query();
        report(measure(
            &format!("search-app/{}", q.id),
            20,
            200,
            || {},
            || search(&connection, &query).map(|rows| rows.iter().map(row_to_entry).count()),
        ));
        report(measure(
            &format!("search-engine/{}", q.id),
            50,
            500,
            || {},
            || search(&connection, &query),
        ));
    }
    drop(open_database(&database)?);

    let result = json!({
        "schema": 1,
        "tier": 1,
        "implementation": "rust",
        "corpus": { "name": corpus, "digest": digest, "files": files, "entries": scanned.entries.len() },
        "env": env::capture(&sqlite),
        "cases": cases,
    });
    if let Some(parent) = out.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&out, format!("{}\n", serde_json::to_string_pretty(&result)?))?;
    println!("{} cases -> {}", cases.len(), out.display());
    Ok(())
}

fn main() -> std::process::ExitCode {
    match run() {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("kb-bench: {error}");
            std::process::ExitCode::FAILURE
        }
    }
}
```

Run: `cargo test -p kb-bench && cargo clippy --workspace --all-targets -- -D warnings`

Expected: 4 passed; clippy clean.

- [ ] **Step 6: The bench task**

Append to `mise.toml`:

```toml
[tasks."bench:rs"]
description = "Tier 1: benchmark kb-domain on a corpus (release build), in the schema bench/ts writes"
usage = 'arg "<corpus>" help="sample, private or private-10x"'
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  corpus="${usage_corpus}"
  if [ "$corpus" = sample ]; then
    digest=$( (cd fixtures/sample && find . -type f \( -name '*.yml' -o -name '*.yaml' \) -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256) | shasum -a 256 | cut -d' ' -f1)
    files=$(find fixtures/sample -type f \( -name '*.yml' -o -name '*.yaml' \) | wc -l | tr -d ' ')
  else
    mise run fixtures
    digest=$(shasum -a 256 fixtures/private.sha256 | cut -d' ' -f1)
    files=$(wc -l < fixtures/private.sha256 | tr -d ' ')
  fi
  cargo build --release -p kb-bench
  target/release/kb-bench --fixtures fixtures --corpus "$corpus" --digest "$digest" --files "$files" \
    --out "docs/experiment/results/tier1-rust-$corpus-$(date -u +%Y%m%dT%H%M%SZ).json"
'''
```

- [ ] **Step 7: Check the digest matches bench/ts's**

Run: `mise run bench:rs sample && mise run bench:ts sample`, then compare
`jq -r .corpus.digest` of the newest `tier1-rust-sample-*.json` and `tier1-ts-node22-sample-*.json`.

Expected: the same digest. Delete both sample results (smoke output).

- [ ] **Step 8: Commit**

```bash
git add Cargo.toml Cargo.lock crates/kb-bench mise.toml
git commit -m "feat(bench): Benchmark kb-domain in the shared results schema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Gates and documents

**Files:**

- Modify: `hk.pkl`, `mise.toml`, `CONTEXT.md`, `README.md`, `docs/experiment/methodology.md`

- [ ] **Step 1: Tests must exist now**

In `hk.pkl` (`push_steps`, `test`) and in `mise.toml` (`tasks.gate`), change
`cargo nextest run --workspace --locked --no-tests=warn` to `cargo nextest run --workspace --locked`.

- [ ] **Step 2: Restore coverage**

In `hk.pkl`, replace the comment that stands in for the coverage step (in `candidate_steps`) with:

```pkl
["coverage"] {
    // A report, not a gate: thresholds come once there is a history to measure them from.
    check = "cargo llvm-cov nextest --workspace --locked --summary-only"
    profiles = List("candidate")
}
```

Run: `hk validate && hk check --all --profile candidate`

Expected: every step passes; `coverage` prints a summary table.

- [ ] **Step 3: Point CONTEXT.md at the code**

In `CONTEXT.md`, drop every _(Plan 2)_ marker, and change the Entry type row's location to
`crates/kb-domain/src/entry.rs` (`Entry::entry_type`; `type` is a Rust keyword, and the type list itself is UI
vocabulary for Plan 3) and the Index row's to `crates/kb-domain/src/sync.rs`, `crates/kb-domain/src/schema.sql`.

- [ ] **Step 4: README**

Under Technology Stack, add `- YAML through saphyr; JSON through serde_json`. Under Development Workflow, add rows
for `mise run parity` (golden parity on the private corpus) and `mise run bench:rs <corpus>` (tier 1, Rust).

- [ ] **Step 5: Methodology**

Under "Tier 1 — engine" in `docs/experiment/methodology.md`, add:

```markdown
The Rust engine runs the same cases (`kb-bench`, release build). `search-app` is each app's real path:
TypeScript opens a read-only connection per query, as `@raycast/utils`' `executeSQL` does; Rust reuses the
connection its app keeps open. Both turn every row back into an entry, re-reading its YAML.
```

- [ ] **Step 6: Run every gate and commit**

Run: `mise run gate`

Expected: every command passes.

```bash
git add hk.pkl mise.toml CONTEXT.md README.md docs/experiment/methodology.md
git commit -m "build: Require tests and report coverage now the engine exists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: The Rust baseline

- [ ] **Step 1: Measure**

On AC power, other heavy apps closed: `mise run bench:rs private && mise run bench:rs private-10x`

Expected: two `64 cases -> docs/experiment/results/tier1-rust-…json` lines.

- [ ] **Step 2: Compare with the TypeScript baseline**

```bash
R=docs/experiment/results
for c in private private-10x; do
  ts=$(ls $R/tier1-ts-node22-$c-20261009T08*.json | tail -1); rs=$(ls $R/tier1-rust-$c-*.json | tail -1)
  jq -r -n --slurpfile t "$ts" --slurpfile r "$rs" --arg c "$c" '
    ($t[0].cases | map({(.name): .stats.p50}) | add) as $T | ($r[0].cases | map({(.name): .stats.p50}) | add) as $R |
    "== \($c)", (["scan","markdown","sync-cold","sync-warm","search-app/q07-word","search-engine/q07-word"][] |
    "\(.)  ts \($T[.] / 1e6 | . * 100 | floor / 100) ms  rust \($R[.] / 1e6 | . * 100 | floor / 100) ms  x\($T[.] / $R[.] * 10 | floor / 10)")'
done
```

Expected, roughly, from the run that validated this plan on `private`: scan ×9.6, markdown ×2, sync ×1.8–2.4,
`search-app` ×3.5–5.8, `search-engine` ×0.7. Report the actual table to the owner — including where Rust is
slower.

- [ ] **Step 3: Commit**

```bash
git add docs/experiment/results
git commit -m "test(experiment): Record the Rust engine baseline at tier 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Findings for Plan 3

Recorded while validating this plan; Plan 3 decides on each:

- `search-engine` is slower in Rust (0.22 ms against 0.16 ms on `q07`): `search` reads every column by name, a
  string lookup per column per row, and copies eleven strings. Reading by index, or selecting only the columns
  the list shows, are the obvious candidates — measure before changing.
- `row_to_entry` re-parses each row's `raw_yaml` for tags and task columns, as the TypeScript app does. The Rust app
  can read tags from `entry_tags` and keep the task columns, if the list profile says it matters.
- `saphyr` and `rusqlite` pull two versions of `hashlink`/`hashbrown`/`foldhash` (`cargo deny` warns): harmless,
  a few kilobytes of binary.
- Kept for parity with the TypeScript engine, to be decided in the app: two entries that resolve to the same id
  (for example keys `1:` and `"1":`) abort the whole sync with an SQLite constraint error, and an unreadable
  subdirectory is skipped without a report. Both engines do this; the normalized sources trigger neither.
- `goldens.rs` resolves `KB_CORPUS`/`KB_GOLDENS` against the workspace root, not the working directory: cargo runs
  integration tests from the crate directory, so the plan's `PathBuf::from` could not find `fixtures/private`.
  Fixed during implementation.
