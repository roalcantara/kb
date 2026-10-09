# kb native port — Plan 3: The GPUI Kit app

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `kb-app` — the kb search command as a native macOS panel on GPUI Kit: ⌥K opens it, typing searches,
the split pane renders highlighted notes, ⌘K lists the entry's actions, ⌘P filters, ⌘R rebuilds the index — at
UI/UX parity with the Raycast command except the owner's D8 deferrals, with a README quickstart.

**Architecture:** A library crate with a thin `main`, so UI integration tests build the views the app shows. Pure
modules (`config`, `presentation`, `filter`, `palette`) hold every Raycast rule as data and are unit-tested; GPUI
units (`entry_list`, `notes`, `sync_view`, `search_view`, `panel`) compose GPUI Kit components — `List`,
`TextView`, `Command`, `Resizable`, `DescriptionList`, `Progress`, `Empty`, `Tag` — and are proven by headless UI
integration tests and a scripted smoke run. Each command is one typed Action; the palette and its shortcut
dispatch the same one.

**Tech Stack:** gpui-kit 0.7.1 (pinned, tree-sitter grammars), global-hotkey 0.8, futures 0.3, toml 0.9, dirs 6;
`kb-domain` from Plan 2.

**Spec:** [2026-10-08-kb-native-port-experiment-design.md](../specs/2026-10-08-kb-native-port-experiment-design.md)
— read D1–D10, and the **GPUI Kit Coding Guides** (`~/.agents/skills/gpui-kit/references/coding-guides.md`) and
**Design Guides** (`~/.agents/skills/gpui-kit-design-guides/references/design-guides.md`) before Task 7.

---

## Before you start

Everything below was built and run before this plan was written, in a clone of this repository at `614d397`:

- three spikes first, on the real corpus: the resident panel and global hotkey; the debounced list with a
  `TextView` notes pane; the ⌘K palette dispatching an Action;
- then the whole crate: `cargo clippy --workspace --all-targets -- -D warnings` (pedantic workspace lints) clean,
  rustdoc clean, **60 tests** passing (`kb-domain` 34, `kb-bench` 4, `kb-app` 17 unit and 5 UI integration),
  `mise run gate`, `hk check --all --profile candidate` and `--profile release` passing;
- a scripted smoke run of the release binary: ⌘R rebuilt 4,233 entries, typing and ⌘↩ copied a command, ⌥K/Esc
  cycles and hide-on-blur held across two fresh launches. Release binary **27.8 MiB**; **93 MiB** RSS open.

Type the code as written. If a step's expected output differs, stop and report it rather than adapting the code.

Five facts this plan depends on, each found by a spike or a failing test:

1. **AppleScript steals focus.** `osascript … keystroke` returns focus to the calling app, which hides the panel.
   Script keys with CGEvent (Task 13 provides the tool). Plan 4's tier 3 harness must do the same.
2. **`List` has no debounce.** `perform_search` returns a `Task`; the list drops the previous one when the query
   changes, so a 150 ms timer inside it is the debounce.
3. **Dialogs live beside the view.** `Root` renders dialogs in its overlay layer, a sibling of the view, so an
   Action dispatched from a palette row never reaches the view's handlers. The palette closes first, then
   dispatches from the view — and focuses its search field one tick after opening (`window.defer`).
4. **A stale deactivation follows every re-show.** Showing a hidden accessory app delivers one deactivation before
   the activation; hide-on-blur waits 100 ms and hides only if the window is still inactive.
5. **`cc` must stay at 1.2.67** (`tree-sitter-sequel` asks for `~1.2`); `cargo update -p cc --precise 1.2.67`.

The first `cargo build` with `gpui-kit` takes several minutes (about 2.5 minutes for a release build afterwards).
Screenshots from a terminal need macOS Screen Recording permission; nothing here depends on them.

## Conventions

As Plans 1–2: work in `~/Work/rust/kb`; `type(scope): Sentence case subject` commits with the attribution line;
hooks run on every commit — if one fixes files, review, `git add`, and commit again. Each task adds to
`crates/kb-app/Cargo.toml` exactly the dependencies it starts to use, so `cargo machete` never sees an unused one.

## File map

| Path                                                                                        | Responsibility                                             | Task |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---- |
| `Cargo.toml`, `.gitignore`, `crates/kb-app/Cargo.toml`, `crates/kb-app/src/lib.rs`          | workspace, crate skeleton                                  | 1    |
| `crates/kb-domain/src/{lib,search,sync}.rs`                                                 | read-only connection, types and tags for the filter        | 2    |
| `crates/kb-app/src/config.rs`                                                               | sources directory, index path, preferences file            | 3    |
| `crates/kb-app/src/{presentation,fixture}.rs`, `deny.toml`, `docs/adr/0005-gpui-kit-pin.md` | labels, icons, primary action, metadata; the GPUI Kit pin  | 4    |
| `crates/kb-app/src/filter.rs`                                                               | filter choices                                             | 5    |
| `crates/kb-app/src/palette.rs`                                                              | Actions, key bindings, palette rows                        | 6    |
| `crates/kb-app/src/entry_list.rs`                                                           | the list delegate: query, filter, page, rows, empty states | 7    |
| `crates/kb-app/src/notes.rs`                                                                | notes and metadata pane                                    | 8    |
| `crates/kb-app/src/sync_view.rs`                                                            | the rebuild screen                                         | 9    |
| `crates/kb-app/src/{search_view,panel,main}.rs`                                             | root view, panel and hotkey, entry point                   | 10   |
| `crates/kb-app/tests/ui.rs`                                                                 | UI integration tests                                       | 11   |
| `bench/probes/size-rs.sh`, `tools/size-budget`, `mise.toml`, `hk.pkl`                       | size budget, `app` and `size` tasks                        | 12   |
| —                                                                                           | scripted smoke run                                         | 13   |
| `README.md`, `CONTEXT.md`, `docs/adr/000{3,4}-*.md`, `docs/experiment/parity.md`            | documents                                                  | 14   |
| `docs/experiment/results/tier2-rust-size-*.json`                                            | close-out                                                  | 15   |

---

### Task 1: The crate skeleton

**Files:**

- Modify: `Cargo.toml`, `.gitignore`
- Create: `crates/kb-app/Cargo.toml`, `crates/kb-app/src/lib.rs`

- [ ] **Step 1: Declare the workspace dependencies and member**

In `Cargo.toml`, set `members = ["crates/kb-domain", "crates/kb-bench", "crates/kb-app"]` and replace the
`[workspace.dependencies]` table with (sorted; the new ones are `dirs`, `futures`, `global-hotkey`, `gpui-kit`,
`toml`):

```toml
[workspace.dependencies]
base64 = "0.22"
dirs = "6"
futures = "0.3"
global-hotkey = "0.8"
# The grammars cover every fence language in the corpus (see docs/adr/0005); json and plain text are built in.
gpui-kit = { version = "=0.7.1", features = [
  "tree-sitter",
  "tree-sitter-bash",
  "tree-sitter-javascript",
  "tree-sitter-kotlin",
  "tree-sitter-markdown",
  "tree-sitter-python",
  "tree-sitter-ruby",
  "tree-sitter-sql",
  "tree-sitter-toml",
  "tree-sitter-typescript",
  "tree-sitter-yaml",
] }
indexmap = "2"
kb-domain = { path = "crates/kb-domain" }
rusqlite = { version = "0.37", features = ["bundled"] }
saphyr = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = { version = "1", features = ["preserve_order"] }
tempfile = "3"
thiserror = "2"
toml = "0.9"
walkdir = "2"
```

- [ ] **Step 2: Create the crate with no dependencies yet**

`crates/kb-app/Cargo.toml`:

```toml
[package]
name = "kb-app"
description = "The kb search panel: a resident GPUI Kit app opened by a global hotkey."
version.workspace = true
edition.workspace = true
rust-version.workspace = true
license.workspace = true
publish.workspace = true
repository.workspace = true

[lints]
workspace = true
```

`crates/kb-app/src/lib.rs` — the crate doc only for now; each task adds its `pub mod`:

```rust
//! The kb search panel: a resident GPUI Kit app over `kb-domain`, opened by a global hotkey.
//!
//! `main` only resolves the configuration and calls [`run`]; everything else is a module here,
//! so the UI integration tests build the same views the app shows.
```

The `kb` binary target is declared in Task 10, with the `main.rs` it names: a `[[bin]]` without its file fails
every cargo command, the commit hooks included.

- [ ] **Step 3: Ignore a symlinked private corpus too**

In `.gitignore`, replace `/fixtures/private*/` with the two lines below. A trailing slash matches directories
only, so a corpus symlinked into `fixtures/` (as a scratch clone does) was not ignored:

```gitignore
/fixtures/private*
!/fixtures/private.sha256
```

Run: `git check-ignore -q fixtures/private.sha256 || echo tracked; ln -s /tmp fixtures/private-probe && git check-ignore fixtures/private-probe; rm fixtures/private-probe`

Expected: `tracked`, then `fixtures/private-probe`.

- [ ] **Step 4: Verify and commit**

Run: `cargo check -p kb-app --lib && cargo machete`

Expected: `Finished`; no unused dependencies.

```bash
git add Cargo.toml Cargo.lock .gitignore crates/kb-app
git commit -m "build: Add the kb-app crate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: What the app reads from the engine

**Files:**

- Modify: `crates/kb-domain/src/lib.rs`, `crates/kb-domain/src/search.rs`, `crates/kb-domain/src/sync.rs`

The app opens the index read-only and lists its types and tags for the filter. `kb-domain` owns the
connection and re-exports its type, so `kb-app` never depends on `rusqlite` (whose `links = "sqlite3"` would
otherwise have to match versions across two crates).

- [ ] **Step 1: Write the failing test**

In `crates/kb-domain/src/sync.rs`, inside `mod tests`, before `replaces_a_corrupt_index`:

```rust
#[test]
fn lists_types_and_tags_from_a_read_only_connection() {
    let root = sources(&[("a.yml", "notes:\n  one: {tags: [b, a]}\ncommands:\n  ls: {tags: [a]}\n")]);
    let db = tempfile::tempdir().unwrap();
    let path = db.path().join("kb.db");
    sync_knowledge_base(root.path(), &path, &AtomicBool::new(false), |_| {}).unwrap();
    let connection = open_readonly(&path).unwrap();
    assert_eq!(crate::search::entry_types(&connection).unwrap(), ["commands", "notes"]);
    assert_eq!(crate::search::tags(&connection).unwrap(), ["a", "b"]);
    assert!(connection.execute("DELETE FROM entries", []).is_err());
}
```

- [ ] **Step 2: Run it to see it fail**

Run: `cargo test -p kb-domain lists_types_and_tags`

Expected: compilation fails — cannot find function `open_readonly`.

- [ ] **Step 3: Implement**

In `crates/kb-domain/src/lib.rs`, before the first `pub mod`:

```rust
pub use rusqlite::Connection;
```

In `crates/kb-domain/src/sync.rs`, before `/// Opens the index with its schema`:

```rust
/// Opens the index read-only, as the app reads it: a sync writes through its own connection.
///
/// # Errors
///
/// An SQLite error, such as a missing file.
pub fn open_readonly(path: &Path) -> rusqlite::Result<Connection> {
    Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
}
```

In `crates/kb-domain/src/search.rs`, before `/// One page of rows for a query.`:

```rust
/// The entry types in the index, sorted: the filter's type choices.
///
/// # Errors
///
/// An SQLite error.
pub fn entry_types(connection: &Connection) -> rusqlite::Result<Vec<String>> {
    column(connection, "SELECT DISTINCT type FROM entries ORDER BY type ASC")
}

/// The tags in the index, sorted: the filter's tag choices.
///
/// # Errors
///
/// An SQLite error.
pub fn tags(connection: &Connection) -> rusqlite::Result<Vec<String>> {
    column(connection, "SELECT DISTINCT tag FROM entry_tags ORDER BY tag ASC")
}

fn column(connection: &Connection, sql: &str) -> rusqlite::Result<Vec<String>> {
    connection
        .prepare_cached(sql)?
        .query_map([], |row| row.get(0))?
        .collect()
}
```

- [ ] **Step 4: Run the crate**

Run: `cargo test -p kb-domain --lib && cargo clippy -p kb-domain --all-targets -- -D warnings`

Expected: 31 passed; clippy clean.

```bash
git add crates/kb-domain/src
git commit -m "feat(domain): Open the index read-only and list its types and tags

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Configuration

**Files:**

- Create: `crates/kb-app/src/config.rs`
- Modify: `crates/kb-app/src/lib.rs`, `crates/kb-app/Cargo.toml`

The preferences are one optional TOML file; the index is the app’s own. Paths come from the caller, so tests use a temporary home.

- [ ] **Step 1: Register the module and write its tests**

Add to `crates/kb-app/Cargo.toml` (create the tables if absent):

```toml
[dependencies]
serde.workspace = true
thiserror.workspace = true
toml.workspace = true

[dev-dependencies]
tempfile.workspace = true
```

Add `pub mod config;` to `lib.rs`, keeping the `pub mod` lines sorted. Create `crates/kb-app/src/config.rs` with
the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn home_with(preferences: Option<&str>) -> tempfile::TempDir {
        let home = tempfile::tempdir().unwrap();
        if let Some(text) = preferences {
            let file = home.path().join(PREFERENCES);
            fs::create_dir_all(file.parent().unwrap()).unwrap();
            fs::write(file, text).unwrap();
        }
        home
    }

    #[test]
    fn defaults_to_the_raycast_sources_directory() {
        let home = home_with(None);
        let config = Config::load(home.path(), Path::new("/data")).unwrap();
        assert_eq!(config.sources_dir(), home.path().join(".config/kodexb/sources"));
        assert_eq!(config.database(), Path::new("/data/kb-native/kb.db"));
    }

    #[test]
    fn reads_the_sources_path_and_expands_home() {
        let home = home_with(Some("sources_path = \"~/Work/knowledge\"\n"));
        let config = Config::load(home.path(), Path::new("/data")).unwrap();
        assert_eq!(config.sources_dir(), home.path().join("Work/knowledge"));
        assert_eq!(expand_home("/abs", home.path()), PathBuf::from("/abs"));
        assert_eq!(expand_home("~", home.path()), home.path());
    }

    #[test]
    fn rejects_unknown_keys() {
        let home = home_with(Some("source_path = \"x\"\n"));
        assert!(matches!(
            Config::load(home.path(), Path::new("/data")),
            Err(ConfigError::Parse { .. })
        ));
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-app --lib config`

Expected: compilation fails — cannot find type `Config`.

- [ ] **Step 3: Write the implementation above the tests**

````rust
//! Where the app reads its sources and keeps its index.
//!
//! The preferences are one optional TOML file, `~/.config/kb/config.toml`:
//!
//! ```toml
//! sources_path = "~/Work/knowledge"
//! ```
//!
//! Without it the sources are `~/.config/kodexb/sources`, as in the Raycast extension. The index
//! is the app's own file in its data directory; the Raycast index is never opened.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Deserialize;

/// The sources directory when the preferences name none.
const DEFAULT_SOURCES: &str = ".config/kodexb/sources";
/// The preferences file, relative to the home directory.
const PREFERENCES: &str = ".config/kb/config.toml";

/// Why the preferences could not be read.
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    /// The file exists but could not be read.
    #[error("cannot read {}: {source}", path.display())]
    Read {
        /// The preferences file.
        path: PathBuf,
        /// The I/O error.
        source: io::Error,
    },
    /// The file is not the expected TOML.
    #[error("{} is not valid: {source}", path.display())]
    Parse {
        /// The preferences file.
        path: PathBuf,
        /// The parser's error.
        source: Box<toml::de::Error>,
    },
}

#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
struct Preferences {
    sources_path: Option<String>,
}

/// The resolved locations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    sources_dir: PathBuf,
    database: PathBuf,
    preferences: PathBuf,
}

impl Config {
    /// Resolves the locations under `home` and `data_dir`, reading the preferences if present.
    ///
    /// # Errors
    ///
    /// The preferences file exists but cannot be read or parsed.
    pub fn load(home: &Path, data_dir: &Path) -> Result<Self, ConfigError> {
        let preferences = home.join(PREFERENCES);
        let parsed = match fs::read_to_string(&preferences) {
            Ok(text) => toml::from_str::<Preferences>(&text).map_err(|source| ConfigError::Parse {
                path: preferences.clone(),
                source: Box::new(source),
            })?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => Preferences::default(),
            Err(source) => {
                return Err(ConfigError::Read {
                    path: preferences,
                    source,
                });
            }
        };
        let sources_dir = parsed
            .sources_path
            .map_or_else(|| home.join(DEFAULT_SOURCES), |path| expand_home(&path, home));
        Ok(Self {
            sources_dir,
            database: data_dir.join("kb-native").join("kb.db"),
            preferences,
        })
    }

    /// The directory the source files are found under.
    #[must_use]
    pub fn sources_dir(&self) -> &Path {
        &self.sources_dir
    }

    /// The index file.
    #[must_use]
    pub fn database(&self) -> &Path {
        &self.database
    }

    /// The preferences file, which may not exist yet.
    #[must_use]
    pub fn preferences(&self) -> &Path {
        &self.preferences
    }
}

/// `~` and `~/…` relative to `home`; any other path as written.
fn expand_home(path: &str, home: &Path) -> PathBuf {
    match path.strip_prefix('~') {
        Some("") => home.to_path_buf(),
        Some(rest) if rest.starts_with('/') => home.join(&rest[1..]),
        _ => PathBuf::from(path),
    }
}
````

- [ ] **Step 4: Run them to see them pass**

Run: `cargo test -p kb-app --lib && cargo clippy -p kb-app --lib --tests -- -D warnings`

Expected: 3 passed; clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-app/src/lib.rs crates/kb-app/src/config.rs crates/kb-app/Cargo.toml Cargo.lock
git commit -m "feat(app): Resolve the sources directory and the index path

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Presentation rules

**Files:**

- Create: `crates/kb-app/src/presentation.rs`, `crates/kb-app/src/fixture.rs`, `docs/adr/0005-gpui-kit-pin.md`
- Modify: `crates/kb-app/src/lib.rs`, `crates/kb-app/Cargo.toml`

Every rule of the Raycast list, pane and actions that is not layout: type keys, labels and icons, the primary-action matrix, tag overflow, the metadata order. `fixture.rs` builds test entries from YAML for this and later modules.

- [ ] **Step 1: Register the module and write its tests**

Add to `crates/kb-app/Cargo.toml` (create the tables if absent):

```toml
[dependencies]
gpui-kit.workspace = true
kb-domain.workspace = true
```

The lockfile holds `cc 1.6.0`, which `gpui-component`'s SQL grammar rejects (it asks for `~1.2`). Resolve the tree
with `cc` held where every dependent accepts it, before anything builds:

```bash
cargo update -p cc --precise 1.2.67
```

Expected: `Downgrading cc v1.6.0 -> v1.2.67` among the lock changes.

Add `pub mod presentation;` to `lib.rs`, and the test-only fixture module after the `pub mod` lines:

```rust
#[cfg(test)]
mod fixture;
```

`crates/kb-app/src/fixture.rs`:

```rust
//! Entries built from YAML for unit tests.

use kb_domain::entry::{Entry, normalize_entry};
use kb_domain::markdown::build_entry_markdown;
use kb_domain::yaml;

/// The entry `key` of `entry_type` whose map is `source`, with its notes compiled, as a sync
/// would index it from `/root/f.yml`.
pub fn entry(entry_type: &str, key: &str, source: &str) -> Entry {
    let raw = yaml::load(source).unwrap().unwrap();
    let mut entry = normalize_entry("/root/f.yml", "f.yml", entry_type, key, &raw);
    entry.notes_markdown = build_entry_markdown(&entry);
    entry
}
```

Create `crates/kb-app/src/presentation.rs` with
the tests alone:

```rust
#[cfg(test)]
mod tests {
    use kb_domain::entry::EntryLink;

    use super::*;
    use crate::fixture::entry;

    #[test]
    fn reads_types_singular_and_case_insensitively() {
        assert_eq!(type_key(" Bookmarks "), TypeKey::Bookmark);
        assert_eq!(type_key("task"), TypeKey::Task);
        assert_eq!(type_key("snippets"), TypeKey::Other);
        assert_eq!(type_label("commands"), "Commands");
        assert_eq!(type_label("snippets"), "Snippets");
        assert_eq!(type_label(""), "");
    }

    #[test]
    fn matches_the_raycast_primary_action_matrix() {
        let cases = [
            ("bookmarks", PrimaryKind::OpenInBrowser, "Open in Browser"),
            ("commands", PrimaryKind::Copy, "Copy Command Snippet"),
            ("cheats", PrimaryKind::Copy, "Copy Cheat Sheet"),
            ("notes", PrimaryKind::Copy, "Copy Notes"),
            ("tasks", PrimaryKind::Copy, "Copy Task"),
            ("snippets", PrimaryKind::Copy, "Copy Primary Content"),
        ];
        for (entry_type, kind, title) in cases {
            let action = primary_action(&entry(entry_type, "key", "title: t\n"));
            assert_eq!(
                (action.kind, action.title, action.content.as_str()),
                (kind, title, "key")
            );
        }
    }

    #[test]
    fn collapses_tags_after_three() {
        let tags: Vec<String> = ["a", "b", "c", "d", "e"].map(String::from).to_vec();
        assert_eq!(row_tags(&tags), (&tags[..3], 2));
        assert_eq!(row_tags(&tags[..2]), (&tags[..2], 0));
    }

    #[test]
    fn falls_back_to_a_placeholder_without_notes() {
        let mut bare = entry("notes", "k", "title: t\n");
        bare.notes_markdown.clear();
        assert_eq!(notes_markdown(&bare), NO_NOTES);
    }

    #[test]
    fn lists_metadata_in_raycast_order() {
        let mut task = entry(
            "tasks",
            "port",
            "desc: Port it\nstatus: todo\npriority: high\ntags: [rust, kb]\nlinks: [{Spec: https://s.example}]\n",
        );
        task.links.push(EntryLink {
            title: None,
            url: "https://u.example".into(),
        });
        let labels: Vec<&str> = metadata(&task).iter().map(|(label, _)| *label).collect();
        assert_eq!(
            labels,
            ["Type", "Status", "Priority", "Description", "Tags", "Links", "Source"]
        );
        assert_eq!(metadata(&task)[4].1, "#rust #kb");
        assert_eq!(metadata(&task)[5].1, "Spec, https://u.example");
        assert_eq!(
            metadata(&entry("bookmarks", "https://b.example", "title: B\n"))[0],
            ("URL", "https://b.example".into())
        );
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-app --lib presentation` (the first build compiles GPUI Kit: several minutes)

Expected: compilation fails — cannot find function `type_key`.

- [ ] **Step 3: Write the implementation above the tests**

```rust
//! What the screens show for an entry: labels, icons, the primary action and the metadata, as
//! plain data. Kept apart from rendering so the Raycast behaviour it reproduces is tested directly.

use gpui_kit::assets::IconName;
use kb_domain::entry::Entry;

/// The notes pane's text when an entry has no notes.
pub const NO_NOTES: &str = "*No additional notes available for this entry.*";

/// Tags shown on a list row before the rest collapse into `+N`.
pub const MAX_ROW_TAGS: usize = 3;

/// An entry type, singular, as the actions and icons distinguish it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TypeKey {
    /// `bookmarks`
    Bookmark,
    /// `commands`
    Command,
    /// `cheats`
    Cheat,
    /// `notes`
    Note,
    /// `tasks`
    Task,
    /// Any other type.
    Other,
}

/// The type, trimmed, lowercased and singular: `Bookmarks` → `Bookmark`.
#[must_use]
pub fn type_key(entry_type: &str) -> TypeKey {
    let normalized = entry_type.trim().to_lowercase();
    match normalized.strip_suffix('s').unwrap_or(&normalized) {
        "bookmark" => TypeKey::Bookmark,
        "command" => TypeKey::Command,
        "cheat" => TypeKey::Cheat,
        "note" => TypeKey::Note,
        "task" => TypeKey::Task,
        _ => TypeKey::Other,
    }
}

/// The type as people read it: the known names, else the type with its first letter capitalized.
#[must_use]
pub fn type_label(entry_type: &str) -> String {
    let normalized = entry_type.trim().to_lowercase();
    let known = match normalized.as_str() {
        "bookmarks" => "Bookmarks",
        "bookmark" => "Bookmark",
        "commands" => "Commands",
        "command" => "Command",
        "cheats" => "Cheats",
        "cheat" => "Cheat",
        "notes" => "Notes",
        "note" => "Note",
        "tasks" => "Tasks",
        "task" => "Task",
        _ => {
            let mut chars = normalized.chars();
            return chars
                .next()
                .map_or_else(String::new, |first| first.to_uppercase().chain(chars).collect());
        }
    };
    known.to_owned()
}

/// The row icon for a type.
#[must_use]
pub fn type_icon(entry_type: &str) -> IconName {
    match type_key(entry_type) {
        TypeKey::Bookmark => IconName::Globe,
        TypeKey::Command => IconName::SquareTerminal,
        TypeKey::Note => IconName::BookOpen,
        TypeKey::Task => IconName::CircleCheck,
        TypeKey::Cheat | TypeKey::Other => IconName::FileText,
    }
}

/// What the primary action does.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrimaryKind {
    /// Open the content in the browser.
    OpenInBrowser,
    /// Copy the content.
    Copy,
}

/// An entry type's primary action, as data.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrimaryAction {
    /// What it does.
    pub kind: PrimaryKind,
    /// Its label.
    pub title: &'static str,
    /// What it opens or copies.
    pub content: String,
}

/// A bookmark opens; commands, cheats, notes and tasks copy.
#[must_use]
pub fn primary_action(entry: &Entry) -> PrimaryAction {
    let (kind, title) = match type_key(&entry.entry_type) {
        TypeKey::Bookmark => (PrimaryKind::OpenInBrowser, "Open in Browser"),
        TypeKey::Command => (PrimaryKind::Copy, "Copy Command Snippet"),
        TypeKey::Cheat => (PrimaryKind::Copy, "Copy Cheat Sheet"),
        TypeKey::Note => (PrimaryKind::Copy, "Copy Notes"),
        TypeKey::Task => (PrimaryKind::Copy, "Copy Task"),
        TypeKey::Other => (PrimaryKind::Copy, "Copy Primary Content"),
    };
    PrimaryAction {
        kind,
        title,
        content: entry.primary_content.clone(),
    }
}

/// The tags a row shows and how many more there are.
#[must_use]
pub fn row_tags(tags: &[String]) -> (&[String], usize) {
    let shown = tags.len().min(MAX_ROW_TAGS);
    (&tags[..shown], tags.len() - shown)
}

/// The Markdown the notes pane renders.
#[must_use]
pub fn notes_markdown(entry: &Entry) -> &str {
    if entry.notes_markdown.is_empty() {
        NO_NOTES
    } else {
        &entry.notes_markdown
    }
}

/// The metadata pane's rows, in the Raycast order: target, type, workflow, description, tags,
/// links, source.
#[must_use]
pub fn metadata(entry: &Entry) -> Vec<(&'static str, String)> {
    let mut rows = Vec::new();
    match type_key(&entry.entry_type) {
        TypeKey::Bookmark => rows.push(("URL", entry.primary_content.clone())),
        TypeKey::Command => rows.push(("Command", entry.primary_content.clone())),
        _ => {}
    }
    rows.push(("Type", type_label(&entry.entry_type)));
    if let Some(status) = &entry.task_status {
        rows.push(("Status", status.clone()));
    }
    if let Some(priority) = &entry.task_priority {
        rows.push(("Priority", priority.clone()));
    }
    if let Some(description) = &entry.description {
        rows.push(("Description", description.clone()));
    }
    if !entry.tags.is_empty() {
        rows.push((
            "Tags",
            entry.tags.iter().map(|t| format!("#{t}")).collect::<Vec<_>>().join(" "),
        ));
    }
    if !entry.links.is_empty() {
        let titles: Vec<&str> = entry
            .links
            .iter()
            .map(|l| l.title.as_deref().unwrap_or(&l.url))
            .collect();
        rows.push(("Links", titles.join(", ")));
    }
    rows.push(("Source", entry.source_rel_path.clone()));
    rows
}
```

- [ ] **Step 3b: Pin `cc`, allow the tree's licenses, record the decision**

Extend `deny.toml` for the tree `gpui-kit` brought in — in `[advisories]`, after `yanked = "deny"`:

```toml
# Unmaintained crates GPUI Kit 0.7.1 pulls in; none is reachable to fix from this workspace.
# Each is reviewed again when gpui-kit is upgraded (docs/adr/0005-gpui-kit-pin.md).
ignore = [
  { id = "RUSTSEC-2024-0384", reason = "instant, via GPUI Kit's dependency tree" },
  { id = "RUSTSEC-2024-0436", reason = "paste, via GPUI Kit's dependency tree" },
  { id = "RUSTSEC-2025-0134", reason = "rustls-pemfile, via GPUI Kit's HTTP client" },
  { id = "RUSTSEC-2026-0192", reason = "ttf-parser, via GPUI's text system" },
  { id = "RUSTSEC-2026-0206", reason = "rustybuzz, via GPUI's text system" },
]
```

and in `[licenses] allow`, after `"CC0-1.0",`:

```toml
# GPUI Kit's tree: enum-iterator (0BSD) and libbz2-rs-sys (bzip2-1.0.6), both permissive.
"0BSD",
"bzip2-1.0.6",
```

`docs/adr/0005-gpui-kit-pin.md`:

```markdown
# 0005. Pin GPUI Kit 0.7.1 and what it brings

- Status: accepted
- Date: 2026-10-09

## Context

`kb-app` depends on GPUI Kit alone (ADR 0001), and through it on GPUI's text, platform and HTTP stacks. Three
things follow from that tree and need a decision rather than a workaround.

## Decision

- `gpui-kit` is pinned to `=0.7.1`. An upgrade is its own change, re-running every gate.
- Its tree-sitter grammars are enabled for the fence languages the corpus uses: bash (also `sh`, `zsh`),
  javascript, typescript, python, ruby, yaml, sql, toml, markdown, kotlin. JSON and plain text are built in. Any
  other fence renders unhighlighted.
- `cc` is held at `1.2.67` in `Cargo.lock`: `gpui-component` needs `tree-sitter-sequel`, which asks for `cc ~1.2`,
  while the newest `cc` that satisfies the rest of the tree is 1.6. `cargo update -p cc --precise 1.2.67` restores it.
- `deny.toml` allows two more permissive licenses in the tree (0BSD, bzip2-1.0.6) and ignores five
  unmaintained-crate advisories GPUI Kit pulls in (`instant`, `paste`, `rustls-pemfile`, `ttf-parser`,
  `rustybuzz`), each with its reason. They are reviewed again on every upgrade.
- The release binary has a size budget, `tools/size-budget`: the first release build (29,184,624 bytes) plus 5 %.
  The `size-budget` hk step fails above it; raising it is an owner decision.

## Consequences

The app is reproducible from the lockfile. Its supply-chain exceptions are visible in one place, with reasons,
instead of being silenced.
```

Run: `cargo deny check`

Expected: `advisories ok, bans ok, licenses ok, sources ok`. These exceptions are a change to a quality gate:
the owner approved them with this plan; record nothing beyond the ADR.

- [ ] **Step 4: Run them to see them pass**

Run: `cargo test -p kb-app --lib && cargo clippy -p kb-app --lib --tests -- -D warnings`

Expected: 8 passed; clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-app/src/lib.rs crates/kb-app/src/presentation.rs crates/kb-app/src/fixture.rs deny.toml docs/adr/0005-gpui-kit-pin.md crates/kb-app/Cargo.toml Cargo.lock
git commit -m "feat(app): Encode the Raycast presentation rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Filter choices

**Files:**

- Create: `crates/kb-app/src/filter.rs`
- Modify: `crates/kb-app/src/lib.rs`

Any selected type and every selected tag (F02). Picking a checked choice removes it; picking another adds it.

- [ ] **Step 1: Register the module and write its tests**

Add `pub mod filter;` to `lib.rs`, keeping the `pub mod` lines sorted. Create `crates/kb-app/src/filter.rs` with
the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| (*v).to_owned()).collect()
    }

    #[test]
    fn adds_an_unchecked_choice_and_removes_a_checked_one() {
        let current = FilterState {
            types: strings(&["commands"]),
            tags: Vec::new(),
        };
        let groups = filter_groups(&strings(&["commands", "notes"]), &strings(&["git"]), &current);
        assert_eq!(
            groups.iter().map(|g| g.label).collect::<Vec<_>>(),
            ["Filters", "Types", "Tags"]
        );
        let types = &groups[1].choices;
        assert_eq!(
            (
                types[0].label.as_str(),
                types[0].checked,
                types[0].next.types.is_empty()
            ),
            ("Commands", true, true)
        );
        assert_eq!(types[1].next.types, strings(&["commands", "notes"]));
        assert_eq!(
            groups[2].choices[0].next,
            FilterState {
                types: strings(&["commands"]),
                tags: strings(&["git"])
            }
        );
        assert_eq!(groups[0].choices[0].next, FilterState::default());
    }

    #[test]
    fn offers_no_clear_choice_without_a_filter() {
        let groups = filter_groups(&strings(&["notes"]), &[], &FilterState::default());
        assert_eq!(groups.iter().map(|g| g.label).collect::<Vec<_>>(), ["Types"]);
    }

    #[test]
    fn summarizes_the_filter() {
        assert_eq!(filter_summary(&FilterState::default()), "All entries");
        assert_eq!(
            filter_summary(&FilterState {
                types: strings(&["commands"]),
                tags: strings(&["git"])
            }),
            "Commands, #git"
        );
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-app --lib filter`

Expected: compilation fails — cannot find function `filter_groups`.

- [ ] **Step 3: Write the implementation above the tests**

```rust
//! The filter's choices: any of the selected types, and every selected tag.

use kb_domain::search::FilterState;

use crate::presentation::type_label;

/// One choice, checked when it is part of the current filter, and the filter picking it gives.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilterChoice {
    /// Its label.
    pub label: String,
    /// Whether it is part of the current filter.
    pub checked: bool,
    /// The filter after picking it.
    pub next: FilterState,
}

/// A labelled group of choices.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilterGroup {
    /// The group label.
    pub label: &'static str,
    /// Its choices, never empty.
    pub choices: Vec<FilterChoice>,
}

fn toggled(values: &[String], value: &str) -> Vec<String> {
    if values.iter().any(|v| v == value) {
        values.iter().filter(|v| *v != value).cloned().collect()
    } else {
        let mut next = values.to_vec();
        next.push(value.to_owned());
        next
    }
}

/// The choices for the index's `types` and `tags` under the `current` filter. Picking a checked
/// choice removes it; picking any other adds it.
#[must_use]
pub fn filter_groups(types: &[String], tags: &[String], current: &FilterState) -> Vec<FilterGroup> {
    let mut groups = Vec::new();
    if !current.types.is_empty() || !current.tags.is_empty() {
        groups.push(FilterGroup {
            label: "Filters",
            choices: vec![FilterChoice {
                label: "Clear All Filters".into(),
                checked: false,
                next: FilterState::default(),
            }],
        });
    }
    let type_choices: Vec<FilterChoice> = types
        .iter()
        .map(|t| FilterChoice {
            label: type_label(t),
            checked: current.types.contains(t),
            next: FilterState {
                types: toggled(&current.types, t),
                tags: current.tags.clone(),
            },
        })
        .collect();
    if !type_choices.is_empty() {
        groups.push(FilterGroup {
            label: "Types",
            choices: type_choices,
        });
    }
    let tag_choices: Vec<FilterChoice> = tags
        .iter()
        .map(|t| FilterChoice {
            label: format!("#{t}"),
            checked: current.tags.contains(t),
            next: FilterState {
                types: current.types.clone(),
                tags: toggled(&current.tags, t),
            },
        })
        .collect();
    if !tag_choices.is_empty() {
        groups.push(FilterGroup {
            label: "Tags",
            choices: tag_choices,
        });
    }
    groups
}

/// The filter in a few words, for the list placeholder: "All entries", "Commands", "Commands, #git".
#[must_use]
pub fn filter_summary(filter: &FilterState) -> String {
    let parts: Vec<String> = filter
        .types
        .iter()
        .map(|t| type_label(t))
        .chain(filter.tags.iter().map(|t| format!("#{t}")))
        .collect();
    if parts.is_empty() {
        "All entries".into()
    } else {
        parts.join(", ")
    }
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `cargo test -p kb-app --lib && cargo clippy -p kb-app --lib --tests -- -D warnings`

Expected: 11 passed; clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-app/src/lib.rs crates/kb-app/src/filter.rs
git commit -m "feat(app): Derive the filter choices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Commands and the palette

**Files:**

- Create: `crates/kb-app/src/palette.rs`
- Modify: `crates/kb-app/src/lib.rs`

One logical command is one Action (Coding Guides: "Events, actions, and focus"). The palette lists them for the selected entry in the Raycast action panel’s order; rows that carry an argument — a link, a text to copy, a filter — run directly.

- [ ] **Step 1: Register the module and write its tests**

Add `pub mod palette;` to `lib.rs`, keeping the `pub mod` lines sorted. Create `crates/kb-app/src/palette.rs` with
the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixture::entry;

    fn labels(groups: &[PaletteGroup]) -> Vec<(&str, Vec<&str>)> {
        groups
            .iter()
            .map(|g| (g.label, g.rows.iter().map(|r| r.label.as_str()).collect()))
            .collect()
    }

    #[test]
    fn offers_the_raycast_actions_for_a_bookmark_with_links() {
        let bookmark = entry(
            "bookmarks",
            "https://b.example",
            "desc: D\nlinks: [{Guide: https://g.example}]\n",
        );
        assert_eq!(
            labels(&entry_palette(Some(&bookmark), false)),
            [
                ("Entry", vec!["Open in Browser"]),
                (
                    "Source & Clipboard",
                    vec!["Copy URL", "Show Details", "Open Source File"]
                ),
                ("Links", vec!["Open Guide", "Copy URL of Guide"]),
                ("Copy", vec!["Copy Title", "Copy Description", "Copy Notes"]),
                ("Administration", vec!["Rebuild Index…", "Open Preferences"]),
            ]
        );
    }

    #[test]
    fn leaves_out_what_an_entry_does_not_have() {
        let command = entry("commands", "ls", "title: List\n");
        let groups = entry_palette(Some(&command), true);
        assert_eq!(
            labels(&groups)[1],
            ("Source & Clipboard", vec!["Hide Details", "Open Source File"])
        );
        assert!(groups.iter().all(|g| g.label != "Links"));
    }

    #[test]
    fn offers_only_administration_without_a_selection() {
        assert_eq!(
            labels(&entry_palette(None, false)),
            [("Administration", vec!["Rebuild Index…", "Open Preferences"])]
        );
    }

    #[test]
    fn binds_every_shortcut_in_the_search_context() {
        assert_eq!(key_bindings().len(), 9);
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-app --lib palette`

Expected: compilation fails — cannot find function `entry_palette`.

- [ ] **Step 3: Write the implementation above the tests**

```rust
//! The commands: typed Actions with key bindings, and the ⌘K palette that lists them for the
//! selected entry.
//!
//! One logical command is one Action. The palette, its key binding and any other entry point
//! dispatch the same Action, so their label, shortcut and result cannot drift apart. Commands
//! that carry an argument (open this link, copy this text) exist only in the palette and run
//! directly.

use gpui_kit::assets::IconName;
use gpui_kit::{Action, KeyBinding, actions};
use kb_domain::entry::Entry;
use kb_domain::search::FilterState;

use crate::presentation::{PrimaryKind, TypeKey, primary_action, type_key};

/// The key context of the search panel; every binding below applies inside it.
pub const CONTEXT: &str = "Search";

actions!(
    kb,
    [
        /// Open the action palette for the selected entry.
        OpenActions,
        /// Open the type and tag filter.
        OpenFilter,
        /// Run the selected entry's primary action.
        RunPrimary,
        /// Copy the selected bookmark's URL.
        CopyUrl,
        /// Show or hide the details pane (list) or the metadata (detail screen).
        ToggleDetails,
        /// Open the selected entry's source file.
        OpenSourceFile,
        /// Rebuild the index from the source files.
        Rebuild,
        /// Open the preferences file.
        OpenPreferences,
        /// Leave the current screen: back to the list, or hide the panel.
        Back,
    ]
);

/// The panel's key bindings.
#[must_use]
pub fn key_bindings() -> Vec<KeyBinding> {
    let context = Some(CONTEXT);
    vec![
        KeyBinding::new("cmd-k", OpenActions, context),
        // The list binds Enter to show details first; elsewhere in the panel Enter runs the
        // primary action, as on the Raycast detail screen.
        KeyBinding::new("enter", RunPrimary, context),
        KeyBinding::new("cmd-p", OpenFilter, context),
        KeyBinding::new("cmd-shift-c", CopyUrl, context),
        KeyBinding::new("cmd-d", ToggleDetails, context),
        KeyBinding::new("cmd-o", OpenSourceFile, context),
        KeyBinding::new("cmd-r", Rebuild, context),
        KeyBinding::new("cmd-shift-,", OpenPreferences, context),
        KeyBinding::new("escape", Back, context),
    ]
}

/// What a palette row does when confirmed.
#[derive(Debug)]
pub enum PaletteCommand {
    /// Dispatch an Action from the panel, as its key binding does.
    Run(Box<dyn Action>),
    /// Open a URL in the browser.
    OpenUrl(String),
    /// Copy text to the clipboard.
    Copy(String),
    /// Replace the list's filter.
    Filter(FilterState),
}

/// One palette row.
#[derive(Debug)]
pub struct PaletteRow {
    /// Its label.
    pub label: String,
    /// Its icon.
    pub icon: IconName,
    /// What it does.
    pub command: PaletteCommand,
}

/// One labelled palette section.
#[derive(Debug)]
pub struct PaletteGroup {
    /// The section label.
    pub label: &'static str,
    /// Its rows, never empty.
    pub rows: Vec<PaletteRow>,
}

fn row(label: impl Into<String>, icon: IconName, command: PaletteCommand) -> PaletteRow {
    PaletteRow {
        label: label.into(),
        icon,
        command,
    }
}

/// The palette for the selected entry, in the Raycast action panel's order; without an entry,
/// only the administration commands.
#[must_use]
pub fn entry_palette(entry: Option<&Entry>, showing_details: bool) -> Vec<PaletteGroup> {
    let mut groups = Vec::new();
    if let Some(entry) = entry {
        let primary = primary_action(entry);
        let icon = if primary.kind == PrimaryKind::OpenInBrowser {
            IconName::Globe
        } else {
            IconName::Copy
        };
        groups.push(PaletteGroup {
            label: "Entry",
            rows: vec![row(primary.title, icon, PaletteCommand::Run(Box::new(RunPrimary)))],
        });

        let mut source = Vec::new();
        if type_key(&entry.entry_type) == TypeKey::Bookmark {
            source.push(row("Copy URL", IconName::Copy, PaletteCommand::Run(Box::new(CopyUrl))));
        }
        let toggle = if showing_details {
            "Hide Details"
        } else {
            "Show Details"
        };
        source.push(row(
            toggle,
            IconName::PanelRight,
            PaletteCommand::Run(Box::new(ToggleDetails)),
        ));
        source.push(row(
            "Open Source File",
            IconName::FolderOpen,
            PaletteCommand::Run(Box::new(OpenSourceFile)),
        ));
        groups.push(PaletteGroup {
            label: "Source & Clipboard",
            rows: source,
        });

        if !entry.links.is_empty() {
            let mut links = Vec::new();
            for link in &entry.links {
                let name = link.title.as_deref().unwrap_or(&link.url);
                links.push(row(
                    format!("Open {name}"),
                    IconName::ExternalLink,
                    PaletteCommand::OpenUrl(link.url.clone()),
                ));
                links.push(row(
                    format!("Copy URL of {name}"),
                    IconName::Copy,
                    PaletteCommand::Copy(link.url.clone()),
                ));
            }
            groups.push(PaletteGroup {
                label: "Links",
                rows: links,
            });
        }

        let mut copy = vec![row(
            "Copy Title",
            IconName::Copy,
            PaletteCommand::Copy(entry.title.clone()),
        )];
        if let Some(description) = &entry.description {
            copy.push(row(
                "Copy Description",
                IconName::Copy,
                PaletteCommand::Copy(description.clone()),
            ));
        }
        if !entry.notes_markdown.is_empty() {
            copy.push(row(
                "Copy Notes",
                IconName::Copy,
                PaletteCommand::Copy(entry.notes_markdown.clone()),
            ));
        }
        groups.push(PaletteGroup {
            label: "Copy",
            rows: copy,
        });
    }
    groups.push(PaletteGroup {
        label: "Administration",
        rows: vec![
            row(
                "Rebuild Index…",
                IconName::RefreshCw,
                PaletteCommand::Run(Box::new(Rebuild)),
            ),
            row(
                "Open Preferences",
                IconName::Settings,
                PaletteCommand::Run(Box::new(OpenPreferences)),
            ),
        ],
    });
    groups
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `cargo test -p kb-app --lib && cargo clippy -p kb-app --lib --tests -- -D warnings`

Expected: 15 passed; clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-app/src/lib.rs crates/kb-app/src/palette.rs
git commit -m "feat(app): Define the commands and the action palette

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: The result list

**Files:**

- Create: `crates/kb-app/src/entry_list.rs`
- Modify: `crates/kb-app/src/lib.rs`

The `ListDelegate` owns the query, filter, page window and the read-only connection. Rows keep stable domain ids (the entry id), never indexes. `confirm(secondary)` records ⌘↩ so the view can run the primary action instead of opening the entry.

- [ ] **Step 1: Write the module**

Add `pub mod entry_list;` to `lib.rs`. `crates/kb-app/src/entry_list.rs`:

```rust
//! The result list: one page of entries for the query and filter, read from the index.

use std::time::Duration;

use gpui_kit::component::empty::{Empty, EmptyDescription, EmptyHeader, EmptyTitle};
use gpui_kit::component::list::{ListDelegate, ListItem, ListState};
use gpui_kit::component::tag::Tag;
use gpui_kit::component::{ActiveTheme as _, Icon, IndexPath, Sizable as _, h_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{App, Context, IntoElement as _, ParentElement, SharedString, Styled as _, Task, Window, div};
use kb_domain::Connection;
use kb_domain::entry::Entry;
use kb_domain::row::row_to_entry;
use kb_domain::search::{FilterState, PAGE_SIZE, SearchQuery, search};

use crate::presentation::{row_tags, type_icon};

/// Keystrokes settle this long before a query runs, as in the Raycast command.
pub const DEBOUNCE: Duration = Duration::from_millis(150);

/// Owns the query, filter and page of the list, and the read-only index connection.
#[derive(Debug)]
pub struct EntryList {
    connection: Option<Connection>,
    query: String,
    filter: FilterState,
    limit: usize,
    entries: Vec<Entry>,
    selected: Option<IndexPath>,
    secondary_confirm: bool,
}

impl EntryList {
    /// A list over `connection`; `None` when there is no index yet.
    #[must_use]
    pub fn new(connection: Option<Connection>) -> Self {
        let mut list = Self {
            connection,
            query: String::new(),
            filter: FilterState::default(),
            limit: PAGE_SIZE,
            entries: Vec::new(),
            selected: None,
            secondary_confirm: false,
        };
        list.refresh();
        list
    }

    /// Whether an index is open.
    #[must_use]
    pub fn has_index(&self) -> bool {
        self.connection.is_some()
    }

    /// Replaces the connection after a sync and runs the query again.
    pub fn set_connection(&mut self, connection: Option<Connection>) {
        self.connection = connection;
        self.refresh();
    }

    /// The read-only connection, for the filter's choices.
    #[must_use]
    pub fn connection(&self) -> Option<&Connection> {
        self.connection.as_ref()
    }

    /// The current filter.
    #[must_use]
    pub fn filter(&self) -> &FilterState {
        &self.filter
    }

    /// Replaces the filter and runs the query again from the first page.
    pub fn set_filter(&mut self, filter: FilterState) {
        self.filter = filter;
        self.limit = PAGE_SIZE;
        self.refresh();
    }

    /// The entries shown.
    #[must_use]
    pub fn entries(&self) -> &[Entry] {
        &self.entries
    }

    /// The selected entry.
    #[must_use]
    pub fn selected_entry(&self) -> Option<&Entry> {
        self.selected.and_then(|ix| self.entries.get(ix.row))
    }

    /// Whether the last confirmation was the secondary one (⌘↩), which runs the primary action.
    #[must_use]
    pub fn is_secondary_confirm(&self) -> bool {
        self.secondary_confirm
    }

    /// Runs the query for the current text, filter and page window.
    fn refresh(&mut self) {
        let Some(connection) = &self.connection else {
            self.entries.clear();
            return;
        };
        let query = SearchQuery {
            text: self.query.clone(),
            filter: self.filter.clone(),
            limit: self.limit,
            offset: 0,
        };
        // A failed query keeps the previous results on screen rather than emptying the list.
        if let Ok(rows) = search(connection, &query) {
            self.entries = rows.iter().map(row_to_entry).collect();
        }
    }

    fn render_row(entry: &Entry, selected: bool, cx: &App) -> ListItem {
        let (tags, more) = row_tags(&entry.tags);
        ListItem::new(SharedString::from(entry.id.clone()))
            .selected(selected)
            .child(
                h_flex()
                    .w_full()
                    .gap_2()
                    .child(Icon::new(type_icon(&entry.entry_type)).text_color(cx.theme().muted_foreground))
                    .child(div().flex_none().child(entry.title.clone()))
                    .child(
                        div()
                            .flex_1()
                            .min_w_0()
                            .truncate()
                            .text_color(cx.theme().muted_foreground)
                            .when_some(entry.description.clone(), ParentElement::child),
                    )
                    .children(tags.iter().map(|tag| Tag::secondary().small().child(format!("#{tag}"))))
                    .when(more > 0, |row| {
                        row.child(div().text_color(cx.theme().muted_foreground).child(format!("+{more}")))
                    })
                    .when(!entry.links.is_empty(), |row| {
                        row.child(
                            div()
                                .text_color(cx.theme().muted_foreground)
                                .child(format!("{} links", entry.links.len())),
                        )
                    }),
            )
    }
}

impl ListDelegate for EntryList {
    type Item = ListItem;

    fn perform_search(&mut self, query: &str, _: &mut Window, cx: &mut Context<ListState<Self>>) -> Task<()> {
        let query = query.to_owned();
        // The list drops the previous task when the query changes again, which cancels it, so
        // only a query that has been stable for DEBOUNCE runs.
        cx.spawn(async move |list, cx| {
            cx.background_executor().timer(DEBOUNCE).await;
            let _ = list.update(cx, |list, cx| {
                let delegate = list.delegate_mut();
                delegate.query = query;
                delegate.limit = PAGE_SIZE;
                delegate.refresh();
                cx.notify();
            });
        })
    }

    fn items_count(&self, _: usize, _: &App) -> usize {
        self.entries.len()
    }

    fn render_item(&mut self, ix: IndexPath, _: &mut Window, cx: &mut Context<ListState<Self>>) -> Option<ListItem> {
        let entry = self.entries.get(ix.row)?;
        Some(Self::render_row(entry, Some(ix) == self.selected, cx))
    }

    fn render_empty(&mut self, _: &mut Window, cx: &mut Context<ListState<Self>>) -> impl gpui_kit::IntoElement {
        let (title, description) = if self.has_index() {
            ("No matching entries", "Adjust the query or clear the filters.")
        } else {
            (
                "No entries indexed yet",
                "Press ⌘R to rebuild the index from your sources.",
            )
        };
        Empty::new()
            .header(
                EmptyHeader::new()
                    .title(EmptyTitle::new().child(title))
                    .description(EmptyDescription::new().child(description)),
            )
            .text_color(cx.theme().muted_foreground)
            .into_any_element()
    }

    fn set_selected_index(&mut self, ix: Option<IndexPath>, _: &mut Window, cx: &mut Context<ListState<Self>>) {
        self.selected = ix;
        cx.notify();
    }

    fn confirm(&mut self, secondary: bool, _: &mut Window, _: &mut Context<ListState<Self>>) {
        self.secondary_confirm = secondary;
    }

    fn has_more(&self, _: &App) -> bool {
        self.entries.len() == self.limit
    }

    fn load_more(&mut self, _: &mut Window, cx: &mut Context<ListState<Self>>) {
        self.limit += PAGE_SIZE;
        self.refresh();
        cx.notify();
    }
}
```

- [ ] **Step 2: Compile and lint**

Run: `cargo clippy -p kb-app --lib --tests -- -D warnings`

Expected: clean. Its behaviour is proven by the UI integration tests (Task 11) and the smoke run (Task 13).

- [ ] **Step 3: Commit**

```bash
git add crates/kb-app/src/lib.rs crates/kb-app/src/entry_list.rs
git commit -m "feat(app): List entries for the query, filter and page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: The notes pane

**Files:**

- Create: `crates/kb-app/src/notes.rs`
- Modify: `crates/kb-app/src/lib.rs`

`TextView::markdown` renders the index’s Markdown; with Task 4’s grammars, `gpui-component` installs the tree-sitter highlighter for fenced code on its own. The id is keyed by the entry, so a pane keeps its parse while the selection stays.

- [ ] **Step 1: Write the module**

Add `pub mod notes;` to `lib.rs`. `crates/kb-app/src/notes.rs`:

```rust
//! An entry's notes and metadata, as the split pane and the detail screen show them.

use gpui_kit::component::description_list::DescriptionList;
use gpui_kit::component::text::TextView;
use gpui_kit::component::{ActiveTheme as _, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{App, IntoElement, ParentElement as _, SharedString, Styled as _};
use kb_domain::entry::Entry;

use crate::presentation::{metadata, notes_markdown};

/// The notes, rendered from the index's Markdown with highlighted code blocks, above the
/// metadata when `show_metadata`.
pub fn notes_pane(entry: &Entry, show_metadata: bool, cx: &App) -> impl IntoElement {
    // Keyed by the entry: a TextView keeps its parse while its id is unchanged.
    let id = SharedString::from(format!("notes-{}", entry.id));
    v_flex()
        .size_full()
        .min_h_0()
        .child(
            TextView::markdown(id, notes_markdown(entry).to_owned())
                .scrollable(true)
                .flex_1()
                .min_h_0()
                .p_3(),
        )
        .when(show_metadata, |pane| {
            let list = metadata(entry).into_iter().fold(
                DescriptionList::horizontal().columns(1).bordered(false),
                |list, (label, value)| list.item(label, value, 1),
            );
            pane.child(
                v_flex()
                    .flex_none()
                    .p_3()
                    .border_t_1()
                    .border_color(cx.theme().border)
                    .child(list),
            )
        })
}
```

- [ ] **Step 2: Compile and lint**

Run: `cargo clippy -p kb-app --lib --tests -- -D warnings`

Expected: clean. Its behaviour is proven by the UI integration tests (Task 11) and the smoke run (Task 13).

- [ ] **Step 3: Commit**

```bash
git add crates/kb-app/src/lib.rs crates/kb-app/src/notes.rs
git commit -m "feat(app): Render notes and metadata

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: The rebuild screen

**Files:**

- Create: `crates/kb-app/src/sync_view.rs`
- Modify: `crates/kb-app/src/lib.rs`, `crates/kb-app/Cargo.toml`

The sync runs on the background executor; its progress comes back over a channel to the foreground task, which
owns every entity update (Coding Guides: "Async work and side effects"). Esc sets the cancel flag; the sync rolls
back and the previous index stays.

- [ ] **Step 1: Register the module and write its tests**

Add to `[dependencies]` in `crates/kb-app/Cargo.toml`:

```toml
futures.workspace = true
```

Add `pub mod sync_view;` to `lib.rs`. Create `crates/kb-app/src/sync_view.rs` with the tests alone:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_thousands() {
        assert_eq!(
            [thousands(7), thousands(4233), thousands(42_330), thousands(1_000_000)],
            ["7", "4,233", "42,330", "1,000,000"]
        );
    }

    #[test]
    fn summarizes_a_sync() {
        let summary = SyncSummary {
            total_indexed: 4233,
            files_scanned: 68,
            files_failed: 1,
            duration_ms: 812,
            errors: Vec::new(),
            files: Vec::new(),
        };
        assert_eq!(summary_line(&summary), "4,233 entries from 68 files in 0.8 s, 1 failed");
    }
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cargo test -p kb-app --lib sync_view`

Expected: compilation fails — cannot find function `thousands`.

- [ ] **Step 3: Write the implementation above the tests**

```rust
//! The rebuild screen: a sync on the background executor, its progress, and its report.

use std::fmt::Write as _;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use futures::StreamExt as _;
use futures::channel::mpsc;
use gpui_kit::component::progress::Progress;
use gpui_kit::component::{ActiveTheme as _, h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    AppContext as _, Context, EventEmitter, InteractiveElement as _, IntoElement, ParentElement as _, Render,
    SharedString, StatefulInteractiveElement as _, Styled as _, Task, Window, div,
};
use kb_domain::report::{FileIssue, FileReport};
use kb_domain::sync::{SyncError, SyncSummary, sync_knowledge_base};

/// Where a sync stands.
#[derive(Debug)]
pub enum SyncStatus {
    /// Files are being read.
    Running {
        /// Files processed.
        files_scanned: usize,
        /// Files in all, once known.
        files_total: usize,
        /// Entries indexed so far.
        entries: usize,
        /// The file just processed.
        current: String,
    },
    /// The index was rebuilt.
    Done(SyncSummary),
    /// The previous index is unchanged.
    Cancelled,
    /// The sync stopped; the previous index is unchanged.
    Failed(String),
}

/// Emitted once, when a sync stops for any reason.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncFinished {
    /// Whether the index was rebuilt.
    pub rebuilt: bool,
    /// What to tell the user: the summary line, or why it stopped.
    pub message: String,
}

/// Owns one sync run.
#[derive(Debug)]
pub struct SyncView {
    status: SyncStatus,
    cancel: Arc<AtomicBool>,
    _run: Task<()>,
}

impl EventEmitter<SyncFinished> for SyncView {}

/// One progress report, owned, sent from the sync thread.
struct SyncTick {
    files_scanned: usize,
    files_total: usize,
    entries: usize,
    current: String,
}

impl SyncView {
    /// Starts rebuilding `database` from `sources`.
    pub fn start(sources: PathBuf, database: PathBuf, cx: &mut Context<Self>) -> Self {
        let cancel = Arc::new(AtomicBool::new(false));
        let flag = cancel.clone();
        let run = cx.spawn(async move |view, cx| {
            let (sender, mut progress) = mpsc::unbounded::<SyncTick>();
            let job = cx.background_spawn(async move {
                sync_knowledge_base(&sources, &database, &flag, |p| {
                    let _ = sender.unbounded_send(SyncTick {
                        files_scanned: p.files_scanned,
                        files_total: p.files_total,
                        entries: p.entries_count,
                        current: p.file.rel_path.clone(),
                    });
                })
            });
            while let Some(p) = progress.next().await {
                let _ = view.update(cx, |view, cx| {
                    view.status = SyncStatus::Running {
                        files_scanned: p.files_scanned,
                        files_total: p.files_total,
                        entries: p.entries,
                        current: p.current,
                    };
                    cx.notify();
                });
            }
            let outcome = job.await;
            let _ = view.update(cx, |view, cx| {
                let rebuilt = outcome.is_ok();
                view.status = match outcome {
                    Ok(summary) => SyncStatus::Done(summary),
                    Err(SyncError::Cancelled) => SyncStatus::Cancelled,
                    Err(error) => SyncStatus::Failed(error.to_string()),
                };
                let message = match &view.status {
                    SyncStatus::Done(summary) => summary_line(summary),
                    SyncStatus::Cancelled => "Rebuild stopped".to_owned(),
                    SyncStatus::Failed(message) => format!("Couldn’t rebuild the index: {message}"),
                    SyncStatus::Running { .. } => String::new(),
                };
                cx.emit(SyncFinished { rebuilt, message });
                cx.notify();
            });
        });
        let status = SyncStatus::Running {
            files_scanned: 0,
            files_total: 0,
            entries: 0,
            current: String::new(),
        };
        Self {
            status,
            cancel,
            _run: run,
        }
    }

    /// Where the sync stands.
    #[must_use]
    pub fn status(&self) -> &SyncStatus {
        &self.status
    }

    /// Whether the sync is still running.
    #[must_use]
    pub fn is_running(&self) -> bool {
        matches!(self.status, SyncStatus::Running { .. })
    }

    /// Asks a running sync to stop; it rolls back and reports [`SyncStatus::Cancelled`].
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::Relaxed);
    }
}

/// One line per file worth a look, failed files first.
fn report_lines(summary: &SyncSummary) -> Vec<(SharedString, String, Option<String>)> {
    let mut lines: Vec<(SharedString, String, Option<String>)> = Vec::new();
    for file in summary.files.iter().filter(|f| f.error.is_some()) {
        let message = file
            .error
            .as_ref()
            .map(|e| e.message.lines().next().unwrap_or_default().to_owned())
            .unwrap_or_default();
        lines.push((
            file.rel_path.clone().into(),
            format!("Failed: {message}"),
            file.excerpt.clone(),
        ));
    }
    for file in summary
        .files
        .iter()
        .filter(|f| f.error.is_none() && !f.issues.is_empty())
    {
        lines.push((file.rel_path.clone().into(), issues_line(file), None));
    }
    lines
}

fn issues_line(file: &FileReport) -> String {
    let skipped: Vec<String> = file
        .issues
        .iter()
        .filter_map(|issue| match issue {
            FileIssue::SkippedEntry { entry_type, key } => Some(format!("{entry_type}/{key}")),
            FileIssue::Empty => None,
        })
        .collect();
    if skipped.is_empty() {
        "No entries".to_owned()
    } else {
        format!("Skipped, not a map: {}", skipped.join(", "))
    }
}

/// "4,233 entries from 68 files in 0.8 s", with failed files when there are any.
#[must_use]
pub fn summary_line(summary: &SyncSummary) -> String {
    let mut line = format!(
        "{} entries from {} files in {:.1} s",
        thousands(summary.total_indexed),
        summary.files_scanned,
        Duration::from_millis(u64::try_from(summary.duration_ms).unwrap_or(u64::MAX)).as_secs_f64()
    );
    if summary.files_failed > 0 {
        let _ = write!(line, ", {} failed", summary.files_failed);
    }
    line
}

fn thousands(n: usize) -> String {
    let digits = n.to_string();
    let mut out = String::new();
    for (ix, c) in digits.chars().enumerate() {
        if ix > 0 && (digits.len() - ix).is_multiple_of(3) {
            out.push(',');
        }
        out.push(c);
    }
    out
}

impl Render for SyncView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let muted = cx.theme().muted_foreground;
        let body = match &self.status {
            SyncStatus::Running {
                files_scanned,
                files_total,
                entries,
                current,
            } => {
                #[allow(clippy::cast_precision_loss)]
                let percent = if *files_total == 0 {
                    0.0
                } else {
                    *files_scanned as f32 * 100.0 / *files_total as f32
                };
                v_flex()
                    .gap_2()
                    .child("Rebuilding the index…")
                    .child(Progress::new("sync-progress").value(percent))
                    .child(div().text_color(muted).child(format!(
                        "{files_scanned} of {files_total} files, {entries} entries · {current}"
                    )))
                    .child(div().text_color(muted).child("Press Esc to stop."))
            }
            SyncStatus::Done(summary) => v_flex()
                .gap_2()
                .min_h_0()
                .child(summary_line(summary))
                .children(report_lines(summary).into_iter().map(|(path, line, excerpt)| {
                    v_flex()
                        .id(path.clone())
                        .gap_1()
                        .child(h_flex().gap_2().child(path).child(div().text_color(muted).child(line)))
                        .when_some(excerpt, |row, excerpt| {
                            row.child(div().font_family("Menlo").text_sm().child(excerpt))
                        })
                }))
                .child(div().text_color(muted).child("Press Esc to return to the list.")),
            SyncStatus::Cancelled => v_flex()
                .gap_2()
                .child("Rebuild stopped. The previous index is unchanged.")
                .child(div().text_color(muted).child("Press ⌘R to try again.")),
            SyncStatus::Failed(message) => v_flex()
                .gap_2()
                .child(format!("Couldn’t rebuild the index: {message}"))
                .child(
                    div()
                        .text_color(muted)
                        .child("Check the sources path in Preferences (⌘⇧,), then press ⌘R."),
                ),
        };
        div().id("sync").size_full().p_4().overflow_y_scroll().child(body)
    }
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `cargo test -p kb-app --lib && cargo clippy -p kb-app --lib --tests -- -D warnings`

Expected: 17 passed; clippy clean.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-app/src/lib.rs crates/kb-app/src/sync_view.rs crates/kb-app/Cargo.toml Cargo.lock
git commit -m "feat(app): Rebuild the index with progress and a report

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: The panel

**Files:**

- Create: `crates/kb-app/src/search_view.rs`, `crates/kb-app/src/panel.rs`, `crates/kb-app/src/main.rs`
- Modify: `crates/kb-app/src/lib.rs`, `crates/kb-app/Cargo.toml`

`SearchView` is the root view: it owns the screens, the split, the palette state and one handler per Action, on
one key context. `panel` makes the app an accessory, opens the pop-up window, registers ⌥K and hides on blur.

- [ ] **Step 1: Dependencies and the binary target**

Add to `[dependencies]` in `crates/kb-app/Cargo.toml`:

```toml
dirs.workspace = true
global-hotkey.workspace = true
```

and, after the `[package]` table:

```toml
[[bin]]
name = "kb"
path = "src/main.rs"
```

Steps 1–4 land together: the binary target needs the `main.rs` of Step 4.

- [ ] **Step 2: The root view**

`crates/kb-app/src/search_view.rs`:

```rust
//! The panel's root view: the search list, the split pane, the detail and rebuild screens, and
//! every command's handler.

use std::fs;
use std::rc::Rc;

use gpui_kit::component::command::{Command, CommandGroup, CommandItem, CommandState};
use gpui_kit::component::list::{List, ListEvent, ListState};
use gpui_kit::component::resizable::{h_resizable, resizable_panel};
use gpui_kit::component::{ActiveTheme as _, Icon, IndexPath, WindowExt as _, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    AppContext as _, ClipboardItem, Context, Entity, FocusHandle, InteractiveElement as _, IntoElement,
    ParentElement as _, Render, Styled as _, Subscription, Window, div, px,
};
use kb_domain::search::{FilterState, entry_types, tags};
use kb_domain::sync::open_readonly;

use crate::config::Config;
use crate::entry_list::EntryList;
use crate::filter::{filter_groups, filter_summary};
use crate::notes::notes_pane;
use crate::palette::{
    Back, CONTEXT, CopyUrl, OpenActions, OpenFilter, OpenPreferences, OpenSourceFile, PaletteCommand, Rebuild,
    RunPrimary, ToggleDetails, entry_palette,
};
use crate::presentation::{PrimaryKind, TypeKey, primary_action, type_key, type_label};
use crate::sync_view::{SyncFinished, SyncView};

/// What fills the panel.
#[derive(Debug)]
enum Screen {
    /// The list, with the split pane when shown.
    Search,
    /// One entry's notes, full width.
    Detail,
    /// A rebuild and its report.
    Rebuild(Entity<SyncView>),
}

/// The panel's root view.
pub struct SearchView {
    config: Config,
    list: Entity<ListState<EntryList>>,
    palette: Entity<CommandState>,
    /// Focus for the screens without the list, so their keys reach this view.
    focus: FocusHandle,
    screen: Screen,
    show_details: bool,
    show_metadata: bool,
    subscriptions: Vec<Subscription>,
}

impl std::fmt::Debug for SearchView {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SearchView")
            .field("screen", &self.screen)
            .field("show_details", &self.show_details)
            .finish_non_exhaustive()
    }
}

impl SearchView {
    /// Opens the index if there is one and builds the list over it.
    pub fn new(config: Config, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let connection = open_readonly(config.database()).ok();
        let list = cx.new(|cx| ListState::new(EntryList::new(connection), window, cx).searchable(true));
        // The first row starts selected, as in Raycast, so Enter and ⌘K act on it at once.
        list.update(cx, |list, cx| {
            if !list.delegate().entries().is_empty() {
                list.set_selected_index(Some(IndexPath::default()), window, cx);
            }
            list.focus(window, cx);
        });
        let palette = cx.new(|cx| CommandState::new(window, cx));
        let subscription = cx.subscribe_in(&list, window, Self::on_list_event);
        Self {
            config,
            list,
            palette,
            focus: cx.focus_handle(),
            screen: Screen::Search,
            show_details: true,
            show_metadata: false,
            subscriptions: vec![subscription],
        }
    }

    /// The list state, for tests.
    #[must_use]
    pub fn list(&self) -> &Entity<ListState<EntryList>> {
        &self.list
    }

    /// Whether the detail screen is showing.
    #[must_use]
    pub fn is_showing_detail(&self) -> bool {
        matches!(self.screen, Screen::Detail)
    }

    fn on_list_event(
        &mut self,
        _: &Entity<ListState<EntryList>>,
        event: &ListEvent,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        match event {
            ListEvent::Select(_) => cx.notify(),
            ListEvent::Confirm(_) => {
                if self.list.read(cx).delegate().is_secondary_confirm() {
                    self.run_primary(&RunPrimary, window, cx);
                } else {
                    self.screen = Screen::Detail;
                    self.show_metadata = false;
                    self.focus.focus(window, cx);
                    cx.notify();
                }
            }
            // Esc in the list leaves the panel, as it closes the Raycast command.
            ListEvent::Cancel => cx.hide(),
        }
    }

    fn run_primary(&mut self, _: &RunPrimary, _: &mut Window, cx: &mut Context<Self>) {
        let Some(action) = self.list.read(cx).delegate().selected_entry().map(primary_action) else {
            return;
        };
        match action.kind {
            PrimaryKind::OpenInBrowser => cx.open_url(&action.content),
            PrimaryKind::Copy => cx.write_to_clipboard(ClipboardItem::new_string(action.content)),
        }
    }

    fn copy_url(&mut self, _: &CopyUrl, _: &mut Window, cx: &mut Context<Self>) {
        let url = self
            .list
            .read(cx)
            .delegate()
            .selected_entry()
            .filter(|e| type_key(&e.entry_type) == TypeKey::Bookmark)
            .map(|e| e.primary_content.clone());
        if let Some(url) = url {
            cx.write_to_clipboard(ClipboardItem::new_string(url));
        }
    }

    fn toggle_details(&mut self, _: &ToggleDetails, _: &mut Window, cx: &mut Context<Self>) {
        match self.screen {
            Screen::Detail => self.show_metadata = !self.show_metadata,
            _ => self.show_details = !self.show_details,
        }
        cx.notify();
    }

    fn open_source_file(&mut self, _: &OpenSourceFile, _: &mut Window, cx: &mut Context<Self>) {
        let path = self
            .list
            .read(cx)
            .delegate()
            .selected_entry()
            .map(|e| e.source_file.clone());
        if let Some(path) = path {
            cx.open_with_system(std::path::Path::new(&path));
        }
    }

    fn open_preferences(&mut self, _: &OpenPreferences, window: &mut Window, cx: &mut Context<Self>) {
        let file = self.config.preferences().to_path_buf();
        if !file.exists() {
            let template = format!(
                "# kb preferences\n# sources_path = \"{}\"\n",
                self.config.sources_dir().display()
            );
            let written = file
                .parent()
                .map_or(Ok(()), fs::create_dir_all)
                .and_then(|()| fs::write(&file, template));
            if let Err(error) = written {
                window.push_notification(format!("Couldn’t create {}: {error}", file.display()), cx);
                return;
            }
        }
        cx.open_with_system(&file);
    }

    fn rebuild(&mut self, _: &Rebuild, window: &mut Window, cx: &mut Context<Self>) {
        if matches!(&self.screen, Screen::Rebuild(sync) if sync.read(cx).is_running()) {
            return;
        }
        let (sources, database) = (
            self.config.sources_dir().to_path_buf(),
            self.config.database().to_path_buf(),
        );
        let sync = cx.new(|cx| SyncView::start(sources, database, cx));
        let subscription = cx.subscribe_in(&sync, window, |this, _, finished: &SyncFinished, window, cx| {
            window.push_notification(finished.message.clone(), cx);
            if finished.rebuilt {
                let connection = open_readonly(this.config.database()).ok();
                this.list.update(cx, |list, cx| {
                    list.delegate_mut().set_connection(connection);
                    cx.notify();
                });
            }
        });
        self.subscriptions.push(subscription);
        self.screen = Screen::Rebuild(sync);
        self.focus.focus(window, cx);
        cx.notify();
    }

    fn back(&mut self, _: &Back, window: &mut Window, cx: &mut Context<Self>) {
        match &self.screen {
            Screen::Rebuild(sync) if sync.read(cx).is_running() => sync.read(cx).cancel(),
            Screen::Search => cx.hide(),
            Screen::Detail | Screen::Rebuild(_) => {
                self.screen = Screen::Search;
                self.list.update(cx, |list, cx| list.focus(window, cx));
            }
        }
        cx.notify();
    }

    /// Opens a palette in a dialog. The dialog sits in Root's overlay layer, beside this view,
    /// so a row's Action is dispatched only after the dialog closes and focus is back here.
    fn open_palette(
        &self,
        placeholder: &'static str,
        groups: Vec<(&'static str, Vec<(CommandItem, PaletteCommand)>)>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let palette = self.palette.clone();
        palette.update(cx, |state, cx| state.set_query("", window, cx));
        let mut command_groups = Vec::new();
        let mut commands: Vec<Vec<PaletteCommand>> = Vec::new();
        for (label, rows) in groups {
            let (items, row_commands): (Vec<_>, Vec<_>) = rows.into_iter().unzip();
            command_groups.push(CommandGroup::new().label(label).items(items));
            commands.push(row_commands);
        }
        let commands = Rc::new(commands);
        let view = cx.entity().downgrade();
        window.open_dialog(cx, move |dialog, _, _| {
            let (palette, command_groups, commands, view) =
                (palette.clone(), command_groups.clone(), commands.clone(), view.clone());
            dialog.close_button(false).p_0().content(move |content, _, _| {
                let (commands, view) = (commands.clone(), view.clone());
                content.child(
                    command_groups
                        .iter()
                        .cloned()
                        .fold(
                            Command::new(&palette).bordered(false).placeholder(placeholder),
                            Command::group,
                        )
                        .on_confirm(move |ix: IndexPath, window, cx| {
                            window.close_dialog(cx);
                            match commands.get(ix.section).and_then(|rows| rows.get(ix.row)) {
                                Some(PaletteCommand::Run(action)) => window.dispatch_action(action.boxed_clone(), cx),
                                Some(PaletteCommand::OpenUrl(url)) => cx.open_url(url),
                                Some(PaletteCommand::Copy(text)) => {
                                    cx.write_to_clipboard(ClipboardItem::new_string(text.clone()));
                                }
                                Some(PaletteCommand::Filter(filter)) => {
                                    let filter = filter.clone();
                                    let _ = view.update(cx, |this, cx| this.apply_filter(filter, cx));
                                }
                                None => {}
                            }
                        }),
                )
            })
        });
        // Opening the dialog moves focus into it; hand it to the palette's search field after.
        let palette = self.palette.clone();
        window.defer(cx, move |window, cx| {
            palette.update(cx, |state, cx| state.focus(window, cx));
        });
    }

    fn open_actions(&mut self, _: &OpenActions, window: &mut Window, cx: &mut Context<Self>) {
        let entry = match self.screen {
            Screen::Rebuild(_) => None,
            _ => self.list.read(cx).delegate().selected_entry().cloned(),
        };
        let showing = if self.is_showing_detail() {
            self.show_metadata
        } else {
            self.show_details
        };
        let groups = entry_palette(entry.as_ref(), showing)
            .into_iter()
            .map(|group| {
                let rows = group
                    .rows
                    .into_iter()
                    .map(|row| {
                        let mut item = CommandItem::new().label(row.label).icon(Icon::new(row.icon));
                        if let PaletteCommand::Run(action) = &row.command {
                            item = item.action(action.boxed_clone());
                        }
                        (item, row.command)
                    })
                    .collect();
                (group.label, rows)
            })
            .collect();
        self.open_palette("Search actions…", groups, window, cx);
    }

    fn open_filter(&mut self, _: &OpenFilter, window: &mut Window, cx: &mut Context<Self>) {
        let delegate = self.list.read(cx).delegate();
        let Some(connection) = delegate.connection() else {
            return;
        };
        let (types, all_tags) = (
            entry_types(connection).unwrap_or_default(),
            tags(connection).unwrap_or_default(),
        );
        let groups = filter_groups(&types, &all_tags, delegate.filter())
            .into_iter()
            .map(|group| {
                let rows = group
                    .choices
                    .into_iter()
                    .map(|choice| {
                        (
                            CommandItem::new().label(choice.label).checked(choice.checked),
                            PaletteCommand::Filter(choice.next),
                        )
                    })
                    .collect();
                (group.label, rows)
            })
            .collect();
        self.open_palette("Filter by type or tag…", groups, window, cx);
    }

    fn apply_filter(&mut self, filter: FilterState, cx: &mut Context<Self>) {
        self.list.update(cx, |list, cx| {
            list.delegate_mut().set_filter(filter);
            cx.notify();
        });
        cx.notify();
    }
}

impl Render for SearchView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let selected = self.list.read(cx).delegate().selected_entry().cloned();
        let content = match &self.screen {
            Screen::Rebuild(sync) => sync.clone().into_any_element(),
            Screen::Detail => match &selected {
                Some(entry) => v_flex()
                    .size_full()
                    .child(div().px_3().pt_3().text_lg().child(entry.title.clone()))
                    .child(
                        div()
                            .px_3()
                            .text_color(cx.theme().muted_foreground)
                            .child(type_label(&entry.entry_type)),
                    )
                    .child(notes_pane(entry, self.show_metadata, cx))
                    .into_any_element(),
                None => div().into_any_element(),
            },
            Screen::Search => h_resizable("search-split")
                .child(
                    resizable_panel()
                        .size(px(320.))
                        .child(List::new(&self.list).search_placeholder(format!(
                            "Search knowledge base… ({})",
                            filter_summary(self.list.read(cx).delegate().filter())
                        ))),
                )
                .when_some(selected.filter(|_| self.show_details), |split, entry| {
                    split.child(resizable_panel().child(notes_pane(&entry, true, cx)))
                })
                .into_any_element(),
        };
        div()
            .track_focus(&self.focus)
            .key_context(CONTEXT)
            .on_action(cx.listener(Self::open_actions))
            .on_action(cx.listener(Self::open_filter))
            .on_action(cx.listener(Self::run_primary))
            .on_action(cx.listener(Self::copy_url))
            .on_action(cx.listener(Self::toggle_details))
            .on_action(cx.listener(Self::open_source_file))
            .on_action(cx.listener(Self::rebuild))
            .on_action(cx.listener(Self::open_preferences))
            .on_action(cx.listener(Self::back))
            .size_full()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .child(content)
    }
}
```

- [ ] **Step 3: The panel**

`crates/kb-app/src/panel.rs`:

```rust
//! The resident panel: an accessory app without a Dock icon, one floating window shown by a
//! global hotkey and hidden when it loses focus (ADR 0004).

use std::time::Duration;

use futures::StreamExt as _;
use futures::channel::mpsc;
use global_hotkey::hotkey::{Code, HotKey, Modifiers};
use global_hotkey::{GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};
use gpui_kit::{
    ActivationPolicy, App, AppContext as _, AsyncApp, Bounds, Entity, Subscription, WindowBounds, WindowKind,
    WindowOptions, px, size,
};

use crate::config::Config;
use crate::palette::key_bindings;
use crate::search_view::SearchView;

/// How long a deactivation must last before the panel hides.
const BLUR_SETTLE: Duration = Duration::from_millis(100);

/// The hotkey that shows the panel: ⌥K.
#[must_use]
pub fn hotkey() -> HotKey {
    HotKey::new(Some(Modifiers::ALT), Code::KeyK)
}

/// The panel window: above other windows, centred, without a title bar.
#[must_use]
pub fn window_options(cx: &App) -> WindowOptions {
    WindowOptions {
        kind: WindowKind::PopUp,
        titlebar: None,
        window_bounds: Some(WindowBounds::Windowed(Bounds::centered(
            None,
            size(px(860.), px(520.)),
            cx,
        ))),
        is_movable: false,
        is_resizable: false,
        is_minimizable: false,
        focus: true,
        show: true,
        ..WindowOptions::default()
    }
}

/// Why the panel could not start.
#[derive(Debug, thiserror::Error)]
pub enum PanelError {
    /// The window could not be opened.
    #[error("cannot open the panel window: {0}")]
    Window(String),
    /// The hotkey could not be registered, usually because another app holds it.
    #[error("cannot register the hotkey ⌥K: {0}")]
    Hotkey(#[from] global_hotkey::Error),
}

/// Opens the panel, registers the hotkey, and keeps both alive for the app's lifetime.
///
/// # Errors
///
/// The window or the hotkey cannot be set up.
pub fn open(config: Config, cx: &mut App) -> Result<(), PanelError> {
    cx.bind_keys(key_bindings());
    cx.set_activation_policy(ActivationPolicy::Accessory);

    let (window, view) = gpui_kit::open_window(window_options(cx), cx, |window, cx| {
        cx.new(|cx| SearchView::new(config, window, cx))
    })
    .map_err(|error| PanelError::Window(error.to_string()))?;
    let hide_on_blur = hide_on_blur(&view, window, cx);

    // The manager must live on the main thread for the app's lifetime; the task below owns it.
    let manager = GlobalHotKeyManager::new()?;
    manager.register(hotkey())?;
    let (sender, mut presses) = mpsc::unbounded();
    GlobalHotKeyEvent::set_event_handler(Some(move |event: GlobalHotKeyEvent| {
        if event.state() == HotKeyState::Pressed {
            let _ = sender.unbounded_send(());
        }
    }));
    cx.spawn(async move |cx: &mut AsyncApp| {
        let _keep = (manager, hide_on_blur);
        while presses.next().await.is_some() {
            cx.update(|cx| {
                cx.activate(true);
                let _ = window.update(cx, |_, window, _| window.activate_window());
            });
        }
    })
    .detach();
    cx.activate(true);
    Ok(())
}

/// Hides the app whenever the panel window stops being the active one.
fn hide_on_blur(view: &Entity<SearchView>, window: gpui_kit::AnyWindowHandle, cx: &mut App) -> Option<Subscription> {
    window
        .update(cx, |_, window, cx| {
            view.update(cx, |_, cx| {
                cx.observe_window_activation(window, |_, window, cx| {
                    if window.is_window_active() {
                        return;
                    }
                    // Showing the app again after a hide delivers one stale deactivation before
                    // the activation it asked for. Hide only if the window is still inactive
                    // once that settles.
                    cx.spawn_in(window, async move |_, cx| {
                        cx.background_executor().timer(BLUR_SETTLE).await;
                        let _ = cx.update(|window, cx| {
                            if !window.is_window_active() {
                                cx.hide();
                            }
                        });
                    })
                    .detach();
                })
            })
        })
        .ok()
}
```

- [ ] **Step 4: Entry points**

`crates/kb-app/src/lib.rs` in full:

```rust
//! The kb search panel: a resident GPUI Kit app over `kb-domain`, opened by a global hotkey.
//!
//! `main` only resolves the configuration and calls [`run`]; everything else is a module here,
//! so the UI integration tests build the same views the app shows.

pub mod config;
pub mod entry_list;
pub mod filter;
#[cfg(test)]
mod fixture;
pub mod notes;
pub mod palette;
pub mod panel;
pub mod presentation;
pub mod search_view;
pub mod sync_view;

use crate::config::Config;

/// Starts the app with `config` and blocks until it quits.
pub fn run(config: Config) {
    gpui_kit::application()
        .with_assets(gpui_kit::assets::Assets)
        .run(move |cx| {
            gpui_kit::init(cx);
            if let Err(error) = panel::open(config, cx) {
                // No window to show it in: report it and quit.
                #[allow(clippy::print_stderr)]
                {
                    eprintln!("kb: {error}");
                }
                cx.quit();
            }
        });
}
```

`crates/kb-app/src/main.rs`:

```rust
//! `kb`: resolves the configuration and runs the panel.

use std::process::ExitCode;

fn main() -> ExitCode {
    let (Some(home), Some(data)) = (dirs::home_dir(), dirs::data_dir()) else {
        #[allow(clippy::print_stderr)]
        {
            eprintln!("kb: cannot find the home and data directories");
        }
        return ExitCode::FAILURE;
    };
    match kb_app::config::Config::load(&home, &data) {
        Ok(config) => {
            kb_app::run(config);
            ExitCode::SUCCESS
        }
        Err(error) => {
            #[allow(clippy::print_stderr)]
            {
                eprintln!("kb: {error}");
            }
            ExitCode::FAILURE
        }
    }
}
```

- [ ] **Step 5: Build, lint, and open it once**

Run: `cargo clippy -p kb-app --all-targets -- -D warnings && cargo run -p kb-app`

Expected: clippy clean; a centred panel appears with "No entries indexed yet" (or your entries, if
`~/Library/Application Support/kb-native/kb.db` exists). Press Esc: it hides. Press ⌥K: it returns. Quit it with
`pkill -x kb`. (This run uses your real home; Task 13 smoke-tests against a throwaway one.)

- [ ] **Step 6: Commit**

```bash
git add crates/kb-app
git commit -m "feat(app): Open the search panel on a global hotkey

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: UI integration tests

**Files:**

- Create: `crates/kb-app/tests/ui.rs`
- Modify: `crates/kb-app/Cargo.toml`

The production `SearchView` in a headless window over the committed sample corpus, driven by real key events
(`~/.agents/skills/gpui-kit/references/gpui/test.md`). One test per Raycast workflow the matrix names: S01, A01,
A02, A03, A04.

- [ ] **Step 1: Test support**

Add to `[dev-dependencies]` in `crates/kb-app/Cargo.toml` (the same version, with the feature):

```toml
gpui-kit = { workspace = true, features = ["test-support"] }
```

- [ ] **Step 2: The tests**

`crates/kb-app/tests/ui.rs`:

```rust
//! UI integration tests: the production `SearchView` in a headless window over the committed
//! sample corpus, driven by real key events.

#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use gpui_kit::test::TestWindowExt as _;
use gpui_kit::{
    AnyWindowHandle, AppContext as _, Bounds, Entity, Point, TestAppContext, WindowBounds, WindowOptions, px, size,
};
use kb_app::config::Config;
use kb_app::entry_list::DEBOUNCE;
use kb_app::palette::key_bindings;
use kb_app::search_view::SearchView;

/// A config whose sources are the sample corpus and whose index is already built.
fn sample_config(home: &Path) -> Config {
    let sample = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/sample")
        .canonicalize()
        .unwrap();
    let preferences = home.join(".config/kb/config.toml");
    fs::create_dir_all(preferences.parent().unwrap()).unwrap();
    fs::write(&preferences, format!("sources_path = \"{}\"\n", sample.display())).unwrap();
    let config = Config::load(home, &home.join("data")).unwrap();
    kb_domain::sync::sync_knowledge_base(config.sources_dir(), config.database(), &AtomicBool::new(false), |_| {})
        .unwrap();
    config
}

fn open(cx: &mut TestAppContext, config: Config) -> (AnyWindowHandle, Entity<SearchView>) {
    cx.update(gpui_kit::init);
    cx.update(|cx| cx.bind_keys(key_bindings()));
    cx.update(|cx| {
        let options = WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(Bounds::new(
                Point::default(),
                size(px(860.), px(520.)),
            ))),
            ..WindowOptions::default()
        };
        gpui_kit::open_window(options, cx, |window, cx| {
            cx.new(|cx| SearchView::new(config, window, cx))
        })
        .unwrap()
    })
}

fn titles(view: &Entity<SearchView>, cx: &mut TestAppContext) -> Vec<String> {
    cx.read(|cx| {
        view.read(cx)
            .list()
            .read(cx)
            .delegate()
            .entries()
            .iter()
            .map(|e| e.title.clone())
            .collect()
    })
}

/// Renders a frame, then types `text` at the focused element.
fn type_text(cx: &mut TestAppContext, window: AnyWindowHandle, text: &str) {
    cx.update_window(window, |_, window, cx| {
        window.render_frame(cx);
        window.input(text, cx);
    })
    .unwrap();
}

/// Renders a frame, then presses the named key.
fn press(cx: &mut TestAppContext, window: AnyWindowHandle, key: &str) {
    cx.update_window(window, |_, window, cx| {
        window.render_frame(cx);
        window.press(key, cx);
    })
    .unwrap();
}

/// Lets the debounce elapse and every task it releases finish.
fn settle(cx: &mut TestAppContext) {
    cx.executor().advance_clock(DEBOUNCE + Duration::from_millis(10));
    cx.run_until_parked();
}

#[gpui_kit::test]
fn lists_entries_by_title_and_narrows_them_as_the_user_types(cx: &mut TestAppContext) {
    let home = tempfile::tempdir().unwrap();
    let (window, view) = open(cx, sample_config(home.path()));
    assert_eq!(titles(&view, cx).len(), 12);

    type_text(cx, window, "docker");
    settle(cx);
    assert_eq!(titles(&view, cx), ["docker ps -a"]);
}

#[gpui_kit::test]
fn copies_a_command_with_its_primary_action(cx: &mut TestAppContext) {
    let home = tempfile::tempdir().unwrap();
    let (window, _view) = open(cx, sample_config(home.path()));
    type_text(cx, window, "kubectl");
    settle(cx);
    press(cx, window, "secondary-enter");
    let copied = cx.read_from_clipboard().and_then(|item| item.text());
    assert_eq!(copied.as_deref(), Some("kubectl get pods -A"));
}

#[gpui_kit::test]
fn copies_the_title_from_the_action_palette(cx: &mut TestAppContext) {
    let home = tempfile::tempdir().unwrap();
    let (window, _view) = open(cx, sample_config(home.path()));
    type_text(cx, window, "rebase");
    settle(cx);
    press(cx, window, "cmd-k");
    cx.run_until_parked();
    type_text(cx, window, "copy title");
    cx.run_until_parked();
    press(cx, window, "enter");
    cx.run_until_parked();
    let copied = cx.read_from_clipboard().and_then(|item| item.text());
    assert_eq!(copied.as_deref(), Some("Interactive rebase"));
}

#[gpui_kit::test]
fn opens_the_detail_screen_on_enter_and_returns_on_escape(cx: &mut TestAppContext) {
    let home = tempfile::tempdir().unwrap();
    let (window, view) = open(cx, sample_config(home.path()));
    press(cx, window, "enter");
    assert!(cx.read(|cx| view.read(cx).is_showing_detail()));
    press(cx, window, "escape");
    assert!(!cx.read(|cx| view.read(cx).is_showing_detail()));
}

#[gpui_kit::test]
fn runs_the_primary_action_with_enter_on_the_detail_screen(cx: &mut TestAppContext) {
    let home = tempfile::tempdir().unwrap();
    let (window, _view) = open(cx, sample_config(home.path()));
    type_text(cx, window, "explicit");
    settle(cx);
    press(cx, window, "enter");
    press(cx, window, "enter");
    let copied = cx.read_from_clipboard().and_then(|item| item.text());
    assert_eq!(copied.as_deref(), Some("./scripts/run.sh --verbose"));
}
```

- [ ] **Step 3: Run them**

Run: `cargo test -p kb-app --test ui && cargo clippy -p kb-app --all-targets -- -D warnings`

Expected: 5 passed; clippy clean.

- [ ] **Step 4: Prove one can fail**

In `search_view.rs`, delete the `.on_action(cx.listener(Self::run_primary))` line, rerun, and expect
`runs_the_primary_action_with_enter_on_the_detail_screen` to fail with `left: None` (⌘↩ in the list calls the
method directly, so only Enter on the detail screen goes through the Action). Restore the line.

- [ ] **Step 5: Commit**

```bash
git add crates/kb-app/tests/ui.rs crates/kb-app/Cargo.toml Cargo.lock
git commit -m "test(app): Drive the panel through its workflows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Size budget and app tasks

**Files:**

- Create: `bench/probes/size-rs.sh`, `tools/size-budget`
- Modify: `mise.toml`, `hk.pkl`

"Small" is a goal the report measures, so the release binary gets a budget like any other gate: the first
release build (29,184,624 bytes on the validation run) plus 5 %.

- [ ] **Step 1: Measure the first release build**

Run: `cargo build --release --locked -p kb-app && stat -f %z target/release/kb`

Expected: about 29 MB. Write `round(bytes × 1.05)` to `tools/size-budget` as one number (the validation run's
file holds `30650000`). If your number differs from 29,184,624 by more than 2 %, report it before going on.

- [ ] **Step 2: The probe**

`bench/probes/size-rs.sh`:

```bash
#!/usr/bin/env bash
# Measures the release `kb` binary and fails when it outgrows the budget in tools/size-budget.
# Usage: size-rs.sh [out.json]   (build first: cargo build --release --locked -p kb-app)
set -euo pipefail

binary=target/release/kb
budget=$(tr -d '[:space:]' <tools/size-budget)
[ -f "$binary" ] || {
  echo "no $binary; run cargo build --release --locked -p kb-app"
  exit 1
}
bytes=$(stat -f %z "$binary")

if [ -n "${1:-}" ]; then
  jq -n --arg date "$(date -u +%FT%TZ)" --arg commit "$(git describe --always --dirty --abbrev=40)" \
    --argjson bytes "$bytes" --argjson budget "$budget" \
    '{schema: 1, tier: 2, metric: "artifact-size", unit: "bytes", implementation: "rust", date: $date,
      repoCommit: $commit, bundle: "release binary, stripped, LTO", bytes: $bytes, budget: $budget}' >"$1"
fi

echo "kb: $((bytes / 1048576)) MiB ($bytes bytes), budget $((budget / 1048576)) MiB"
if [ "$bytes" -gt "$budget" ]; then
  echo "    -> the binary outgrew its budget; find the cause with cargo bloat before raising tools/size-budget"
  exit 1
fi
```

Run: `chmod +x bench/probes/size-rs.sh && shellcheck bench/probes/size-rs.sh && bench/probes/size-rs.sh`

Expected: `kb: 27 MiB (… bytes), budget 29 MiB`.

- [ ] **Step 3: Tasks and the release step**

Append to `mise.toml`:

```toml
[tasks.app]
description = "Build the panel in release mode and start it; press ⌥K to show it"
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  cargo build --release --locked -p kb-app
  exec target/release/kb
'''

[tasks.size]
description = "Build the release binary, check it against tools/size-budget, and record it under docs/experiment/results"
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  cargo build --release --locked -p kb-app
  bench/probes/size-rs.sh "docs/experiment/results/tier2-rust-size-$(date -u +%Y%m%dT%H%M%SZ).json"
'''
```

In `hk.pkl`, in `release_steps`, after the `cargo-deny` step:

```pkl
// "Small" is one of the experiment's goals, so the release binary has a budget
// (tools/size-budget: the first release build plus 5 %). Raising it is an owner decision.
["size-budget"] {
    profiles = List("release")
    check = "cargo build --release --locked -p kb-app && bench/probes/size-rs.sh"
}
```

Run: `hk validate && hk check --all --profile release`

Expected: every step passes, `size-budget` among them.

- [ ] **Step 4: Commit**

```bash
git add bench/probes/size-rs.sh tools/size-budget mise.toml hk.pkl
git commit -m "build: Give the release binary a size budget

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Smoke run

**Files:** none committed (`tmp/` is gitignored).

What no headless test can prove: the real window, the hotkey, focus and blur, on the private corpus. The terminal
running this needs **Accessibility** permission (System Settings → Privacy & Security), as in Plan 1 Task 14.

- [ ] **Step 1: Build the tools**

`tmp/key.swift`:

```swift
import CoreGraphics

// key <virtual keycode> [opt|cmd|cmd-shift]: posts one key press as the HID system would.
let code = CGKeyCode(Int(CommandLine.arguments[1])!)
let mods = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : ""
var flags: CGEventFlags = []
if mods.contains("opt") { flags.insert(.maskAlternate) }
if mods.contains("cmd") { flags.insert(.maskCommand) }
if mods.contains("shift") { flags.insert(.maskShift) }
let source = CGEventSource(stateID: .hidSystemState)
for down in [true, false] {
    let event = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: down)!
    event.flags = flags
    event.post(tap: .cghidEventTap)
    usleep(20000)
}
```

`tmp/windows.swift`:

```swift
import CoreGraphics

// windows <app name>: one line per window of the app, whether it is on screen and its level.
let info = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: Any]]
for window in info where (window[kCGWindowOwnerName as String] as? String) == CommandLine.arguments[1] {
    let bounds = window[kCGWindowBounds as String] as! [String: Any]
    print("onscreen=\(window[kCGWindowIsOnscreen as String] ?? false) layer=\(window[kCGWindowLayer as String]!) \(bounds["Width"]!)x\(bounds["Height"]!)")
}
```

Run: `swiftc -O -o tmp/key tmp/key.swift && swiftc -O -o tmp/windows tmp/windows.swift`

- [ ] **Step 2: A throwaway home over the private corpus**

```bash
mise run fixtures
H=$PWD/tmp/smokehome; rm -rf "$H"; mkdir -p "$H/.config/kb"
printf 'sources_path = "%s"\n' "$PWD/fixtures/private" > "$H/.config/kb/config.toml"
cargo build --release --locked -p kb-app
(HOME=$H target/release/kb > tmp/kb.log 2>&1 &); sleep 4
```

- [ ] **Step 3: Rebuild, search, act**

```bash
tmp/key 15 cmd; sleep 5                                    # ⌘R: rebuild
sqlite3 "$H/Library/Application Support/kb-native/kb.db" "select count(*) from entries"
tmp/key 53; sleep 0.5; printf before | pbcopy              # Esc: back to the list
for k in 2 31 8 40; do tmp/key $k; sleep 0.05; done        # d o c k
sleep 0.6; tmp/key 36 cmd; sleep 0.5; pbpaste; echo        # ⌘↩: copy the top command
```

Expected: `4233` (or the private corpus's current count), then a docker command on the clipboard.

- [ ] **Step 4: Show, hide, blur**

```bash
w() { tmp/windows kb | grep 'layer=101' | cut -d' ' -f1; }
for i in 1 2 3; do tmp/key 53; sleep 1.5; a=$(w); tmp/key 40 opt; sleep 1.5; echo "esc→$a ⌥K→$(w)"; done
open -a Finder; sleep 1.5; echo "blur→$(w)"
ps -o rss= -p "$(pgrep -x kb)" | awk '{printf "RSS %.0f MiB\n", $1/1024}'
pkill -x kb
```

Expected: three lines `esc→onscreen=false ⌥K→onscreen=1`, then `blur→onscreen=false`, then an RSS near 100 MiB.
If any ⌥K line reads `onscreen=false`, stop: fact 4 of "Before you start" has regressed.

- [ ] **Step 5: Look at it**

Open it with `HOME=$H target/release/kb`, press ⌥K, and check by eye, against the same entries in Raycast, the
ten representative entries the spec's visual check names (code-heavy, tables, mermaid, bookmarks, tasks): code is
highlighted, tables are tables, the split resizes. Note any difference in `docs/experiment/parity.md` (Task 14).

### Task 14: Documents

**Files:**

- Modify: `README.md`, `CONTEXT.md`, `docs/adr/0003-native-mermaid.md`, `docs/adr/0004-resident-panel-and-hotkey.md`,
  `docs/experiment/parity.md`

- [ ] **Step 1: README quickstart**

Replace the README's `## Getting Started` section with the one below. The README schema allows no `###`
subsections there, so the parts are bold labels:

````markdown
## Getting Started

**Quickstart.**

```bash
mise run setup        # tools, crates, TS bench dependencies, git hooks
mise run app          # build and start the panel (release build)
```

Then press **⌥K** anywhere to open the panel, and **⌘R** once to build the index from your sources.

| Key  | Does                                                 |
| ---- | ---------------------------------------------------- |
| type | search titles, descriptions and notes                |
| ↑ ↓  | move the selection                                   |
| ↩    | show the entry; on the entry, run its main action    |
| ⌘↩   | run the main action: open a bookmark, copy a command |
| ⌘K   | all actions for the selected entry                   |
| ⌘P   | filter by type and tag                               |
| ⌘D   | show or hide the details pane                        |
| ⌘R   | rebuild the index                                    |
| ⌘⇧,  | open the preferences file                            |
| Esc  | back, then hide the panel                            |

The sources are `~/.config/kodexb/sources` unless `~/.config/kb/config.toml` says otherwise:

```toml
sources_path = "~/Work/knowledge"
```

The index lives in `~/Library/Application Support/kb-native/kb.db`; the Raycast extension's index is never
touched.

**Working on it.**

```bash
mise run gate         # every quality gate, stopping at the first failure
```

The TS baseline reads the Raycast repository at `$KB_TS_REPO` (default `~/Work/raycast/kb`) and never writes to
it.
````

And in `## Key Features`, make the first bullet:

```markdown
- The kb search experience — FTS search, filters, split pane, rendered notes with highlighted code, actions,
  sync — as a native panel opened by ⌥K.
```

Run: `dprint fmt README.md && mdschema check README.md`

Expected: `No violations found`.

- [ ] **Step 2: CONTEXT.md**

`CONTEXT.md` in full:

```markdown
# Context

The domain words of this repository, each with where it lives. They are kb's words; code, specs and prompts use
them and no synonyms. Locations marked _(Plan N)_ do not exist yet.

| Term              | Meaning                                                                                                                   | Lives in                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Entry             | One knowledge node users can search and open: a YAML key under an entry type. Its id is `<rel path>#<type>#<key>`.        | `crates/kb-domain/src/entry.rs`                                                                                |
| Entry type        | The top-level YAML key an entry sits under (`commands`, `bookmarks`, `tasks`…). Unknown keys are kept, not rejected.      | `crates/kb-domain/src/entry.rs` (`Entry::entry_type`); labels and icons in `crates/kb-app/src/presentation.rs` |
| Sources directory | Where source files are found, recursively: `sources_path` in `~/.config/kb/config.toml`, else `~/.config/kodexb/sources`. | `crates/kb-app/src/config.rs`                                                                                  |
| Source file       | A `.yml` or `.yaml` file under the sources directory; the only source of truth, never written.                            | `crates/kb-domain/src/source.rs`                                                                               |
| Primary content   | What an entry's main action opens or copies: its `url`, `cmd`, `cheat` or `task` field, else its key.                     | `crates/kb-domain/src/entry.rs`                                                                                |
| Tags              | An entry's `tags` (or `tag`) labels, lowercased. Filterable; not in the full-text index.                                  | `crates/kb-domain/src/entry.rs`                                                                                |
| Index             | `kb.db`: `entries`, the `entries_fts` FTS5 table, `entry_tags` — the Raycast schema, in the app's own support directory.  | `crates/kb-domain/src/sync.rs`, `crates/kb-domain/src/schema.sql`                                              |
| Index row         | The SQLite projection of one entry, including the pre-compiled notes Markdown.                                            | `crates/kb-domain/src/row.rs`                                                                                  |
| Notes             | An entry's documentation in whatever shape its source file used; compiled to Markdown at sync time.                       | `crates/kb-domain/src/markdown.rs`                                                                             |
| Query             | The search text plus the filter and page window. Each word becomes an FTS5 prefix term; results are ordered by rank.      | `crates/kb-domain/src/query.rs`                                                                                |
| Filter            | The entry types and tags a query is narrowed to: any selected type, and every selected tag.                               | `crates/kb-domain/src/search.rs`                                                                               |
| Sync              | The manual rebuild of the index from the source files; cancellable, transactional.                                        | `crates/kb-domain/src/sync.rs`                                                                                 |
| Sync report       | What a sync says about each source file: entries indexed, entries skipped, or why the file failed to parse.               | `crates/kb-domain/src/report.rs`                                                                               |
| Panel             | The floating window the hotkey opens; hidden on Esc or when it loses focus.                                               | `crates/kb-app/src/panel.rs`                                                                                   |
| Hotkey            | The global key combination that shows the panel: ⌥K.                                                                      | `crates/kb-app/src/panel.rs`                                                                                   |
| Palette           | The ⌘K list of commands for the selected entry; each runs the same Action as its shortcut.                                | `crates/kb-app/src/palette.rs`                                                                                 |

## Experiment

| Term       | Meaning                                                                                               | Lives in                          |
| ---------- | ----------------------------------------------------------------------------------------------------- | --------------------------------- |
| Corpus     | A set of source files a run measures: `sample` (committed), `private` and `private-10x` (local only). | `fixtures/`, `bench/ts/corpus.ts` |
| Golden     | An output of the TypeScript engine the Rust engine must reproduce.                                    | `fixtures/*-goldens/`             |
| Tier       | A measurement depth: 1 engine, 2 footprint, 3 perceived latency.                                      | `docs/experiment/methodology.md`  |
| Result     | One run's JSON, in the shared schema, under `docs/experiment/results/`.                               | `bench/ts/bench.ts`               |
| Parity row | One user-visible behaviour of the Raycast command and its status in the port.                         | `docs/experiment/parity.md`       |
```

- [ ] **Step 3: ADRs**

`docs/adr/0003-native-mermaid.md` in full:

```markdown
# 0003. Render mermaid natively

- Status: deferred (design decision D8, 2026-10-09)
- Date: 2026-10-08

## Context

The TypeScript engine turns a `mermaid` notes block into an image served by `mermaid.ink`: it needs the network
and sends the diagram source to a third party.

## Decision

The Markdown keeps the TypeScript engine's output byte for byte. `kb-app` renders those image references, when
they point at `mermaid.ink`, with the `merman` crate instead, offline.

## Consequences

Diagrams render offline and privately. `merman` adds to the binary; its size is reported separately.

## Update, 2026-10-09

Deferred out of the MVP by the owner (D8). `kb-app` shows the `mermaid.ink` image the Markdown links, as Raycast
does; `merman` is the first follow-up after the experiment.
```

`docs/adr/0004-resident-panel-and-hotkey.md` in full:

```markdown
# 0004. A resident panel opened by a global hotkey

- Status: accepted
- Date: 2026-10-08

## Context

Raycast keeps running and shows kb in a floating panel. A port launched as an ordinary app would compare its cold
start with Raycast's warm one.

## Decision

`kb-app` runs resident without a Dock icon, registers a global hotkey with the `global-hotkey` crate, and shows a
GPUI pop-up window that hides on Esc or when it loses focus. All of it lives in `crates/kb-app/src/panel.rs`.

## Consequences

Tier 3 compares warm with warm. The hotkey is the only piece outside GPUI Kit.

Two platform details, found while building it:

- Showing the app again after a hide delivers one stale deactivation before the activation it asked for, so the
  panel hides on blur only when the window is still inactive 100 ms later.
- AppleScript key events (`osascript … keystroke`) pull focus back to the calling app and hide the panel; scripted
  tests and the tier 3 harness post keys with CGEvent instead.
```

- [ ] **Step 4: The parity matrix**

`docs/experiment/parity.md` in full — every row now has a status, its evidence, and a justification unless it is
Same. Add what Task 13 Step 5 found:

```markdown
# UI/UX parity

One row per user-visible behaviour of kb's Raycast search command. Sources are paths in the Raycast repo
(`apps/kb/src/`). **Status** is Same, Adapted, Better or Missing; anything but Same carries a justification.
Plan 3 filled in Status and Evidence: a unit or UI integration test where one exists, else the code that
implements the row. Deferred items are owner decisions (D8); the visual check of S12 is manual.

## Surfaces

| #   | Behaviour in Raycast                                                                                                                                                           | Source                               | Status  | Evidence                                                                            | Justification                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| S01 | Search field with placeholder "Search knowledge base..."; typing searches after 150 ms                                                                                         | `search.screen.tsx`, `use-search.ts` | Same    | `lists_entries_by_title_and_narrows_them_as_the_user_types`; `entry_list::DEBOUNCE` |                                                                                                                                       |
| S02 | Results ordered by FTS rank; by title when the query is empty                                                                                                                  | `search.ts` (domain)                 | Same    | golden parity (Plan 2), `kb_domain::search`                                         |                                                                                                                                       |
| S03 | Pages of 50; the next page loads at the end of the list                                                                                                                        | `pagination.ts`                      | Same    | `EntryList::has_more`, `load_more`                                                  |                                                                                                                                       |
| S04 | Previous results stay on screen while the next query runs; a loading indicator shows                                                                                           | `use-search.ts`                      | Adapted | `EntryList::refresh` keeps rows on failure                                          | Results update in place under a millisecond, so there is no loading phase to indicate.                                                |
| S05 | Row icon: type icon tinted by type colour; bookmarks show the site favicon, globe fallback; tooltip names the type                                                             | `icons.ts`, `accessories.ts`         | Adapted | `presentation::type_icon`                                                           | Type icons in the theme’s muted colour, without per-type tints (Design Guides: colour is not decoration). Favicons are deferred (D8). |
| S06 | Row title, and the description as subtitle                                                                                                                                     | `search.screen.tsx`                  | Same    | `EntryList::render_row`                                                             |                                                                                                                                       |
| S07 | Row accessories: up to 3 tags (`#tag`, colour hashed from the tag, or the tag's icon from assets), `+N` for the rest, link count with a link icon                              | `accessories.ts`, `assets.ts`        | Adapted | `presentation::row_tags`; `EntryList::render_row`                                   | Neutral tags, not hashed colours (Design Guides: keep badges neutral). Tag icons from assets are deferred (D8).                       |
| S08 | Empty states: Loading…; No entries indexed yet (with Rebuild); No matching entries                                                                                             | `empty.tsx`                          | Adapted | `EntryList::render_empty`                                                           | No loading state: the list renders from the open index at once. The rebuild hint names ⌘R instead of an inline button.                |
| S09 | Split pane toggled with → and ←: the notes Markdown, or "_No additional notes available for this entry._", above the metadata                                                  | `detail.tsx`, `actions.tsx`          | Adapted | `notes::notes_pane`; ⌘D                                                             | ⌘D toggles the pane: → and ← move the search field’s cursor in GPUI. The split is resizable.                                          |
| S10 | Metadata, in order: URL link (bookmarks) or Command (commands); Type tag; Status; Priority; Description; Tags; Links; Source                                                   | `metadata.tsx`                       | Same    | `presentation::lists_metadata_in_raycast_order`                                     |                                                                                                                                       |
| S11 | Detail screen pushed with Return: the entry title as navigation title, the notes, metadata toggled with → and ←                                                                | `detail.tsx`                         | Adapted | `opens_the_detail_screen_on_enter_and_returns_on_escape`                            | A full-width screen in the same panel, metadata toggled with ⌘D (see S09).                                                            |
| S12 | Notes rendering: headings, lists, tables, blockquote description, highlighted code blocks, YouTube thumbnail, SVG and image blocks, mermaid diagram, LINKS list, source footer | `markdown.ts` (domain)               | Same    | `TextView` with tree-sitter grammars (ADR 0005); visual check                       | Mermaid, SVG and images render as images, as in Raycast; native mermaid is deferred (D8).                                             |

## Filter

| #   | Behaviour in Raycast                                                                                          | Source                    | Status  | Evidence                                                                             | Justification                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------- | ------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F01 | A dropdown beside the search field: a summary item and Clear All Filters; a Types section; a Tags section     | `filter.tsx`              | Adapted | `filter::filter_groups`; ⌘P                                                          | A palette opened by ⌘P, with the same three sections and checked choices, instead of a dropdown beside the field; the field’s placeholder shows the active filter. |
| F02 | Choosing a type or tag toggles it; several can be active; any selected type and every selected tag must match | `filter.tsx`, `search.ts` | Same    | `filter::adds_an_unchecked_choice_and_removes_a_checked_one`; golden queries q26–q29 |                                                                                                                                                                    |
| F03 | Filters reset on every launch                                                                                 | `filter.tsx`              | Same    | `EntryList::new` starts unfiltered                                                   |                                                                                                                                                                    |

## Actions

| #   | Behaviour in Raycast                                                                                                                                            | Source        | Status  | Evidence                                                                                | Justification                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A01 | ⌘K opens the action panel; actions are grouped in sections with their shortcuts shown                                                                           | `actions.tsx` | Same    | `copies_the_title_from_the_action_palette`; `palette::entry_palette`                    |                                                                                                    |
| A02 | List: Return shows details (push)                                                                                                                               | `actions.tsx` | Same    | `opens_the_detail_screen_on_enter_and_returns_on_escape`                                |                                                                                                    |
| A03 | List: ⌘Return runs the type's primary action — Open in Browser (bookmarks); Copy Command Snippet; Copy Cheat Sheet; Copy Notes; Copy Task; Copy Primary Content | `actions.tsx` | Same    | `copies_a_command_with_its_primary_action`; `matches_the_raycast_primary_action_matrix` |                                                                                                    |
| A04 | Detail: Return runs the type's primary action                                                                                                                   | `actions.tsx` | Same    | `runs_the_primary_action_with_enter_on_the_detail_screen`                               |                                                                                                    |
| A05 | ⌘C copies a bookmark's URL                                                                                                                                      | `actions.tsx` | Same    | `SearchView::copy_url`, ⌘⇧C (Raycast’s Copy shortcut)                                   |                                                                                                    |
| A06 | → / ← show and hide Details (list) or Metadata (detail)                                                                                                         | `actions.tsx` | Adapted | ⌘D                                                                                      | See S09.                                                                                           |
| A07 | ⌘O opens the source file                                                                                                                                        | `actions.tsx` | Same    | `SearchView::open_source_file`, ⌘O                                                      |                                                                                                    |
| A08 | Links submenu: per link, Open and Copy URL                                                                                                                      | `actions.tsx` | Adapted | `offers_the_raycast_actions_for_a_bookmark_with_links`                                  | A Links section of the palette instead of a submenu.                                               |
| A09 | Copy… submenu: Title, Description, Notes, Raw YAML (Description and Notes only when present)                                                                    | `actions.tsx` | Adapted | `palette::entry_palette`                                                                | Copy Raw YAML is deferred (D8); Title, Description and Notes as in Raycast.                        |
| A10 | ⌘R Rebuild Index…; ⌘⇧, Open Extension Preferences                                                                                                               | `actions.tsx` | Adapted | ⌘R, ⌘⇧,                                                                                 | Preferences open `~/.config/kb/config.toml` in the default editor; there is no preferences window. |

## Sync

| #   | Behaviour in Raycast                                                                                             | Source                                | Status  | Evidence                           | Justification                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Y01 | Rebuild screen with progress: files scanned of total, entries, current file; can be stopped                      | `sync/screen.tsx`, `sync/progress.ts` | Adapted | `sync_view::SyncView`              | Esc stops a running rebuild instead of a Stop action.                                            |
| Y02 | A toast on completion; on failure, a toast with Open Extension Preferences                                       | `sync/use-sync.ts`                    | Same    | `SearchView::rebuild` notification |                                                                                                  |
| Y03 | Report: files in sections by status; a file's detail shows an excerpt and File, Status, Location, Entries, Types | `sync/report.ts`, `sync/file.tsx`     | Adapted | `sync_view::report_lines`          | One report list, failed files first with their excerpt; a per-file detail view is deferred (D8). |
| Y04 | Stopped and Failed states, with Retry and Open Extension Preferences                                             | `sync/screen.tsx`                     | Adapted | `SyncStatus::Cancelled`, `Failed`  | Retry is ⌘R and Preferences ⌘⇧,, as named on screen, not buttons.                                |

## Launch and preferences

| #   | Behaviour in Raycast                                                               | Source     | Status | Evidence                                            | Justification                                                                    |
| --- | ---------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| L01 | Opened from Raycast's root search or a user-assigned hotkey; Esc pops, then closes | Raycast    | Better | `panel.rs`; ADR 0004                                | A resident panel on ⌥K that hides on Esc or blur, without opening Raycast first. |
| P01 | The Sources Directory preference, defaulting to `~/.config/kodexb/sources`         | `paths.ts` | Same   | `config::defaults_to_the_raycast_sources_directory` |                                                                                  |

## Tasks

The five tasks measured for task cost (keystrokes and tier 3 time) in Plan 4, on both apps.

| #  | Task                                               |
| -- | -------------------------------------------------- |
| T1 | Find a bookmark by a word in its title and open it |
| T2 | Find a command and copy it                         |
| T3 | Filter by one type and one tag                     |
| T4 | Read a code-heavy note in the detail screen        |
| T5 | Rebuild the index                                  |
```

Run: `dprint check && typos && grep -cE '\| (Same|Adapted|Better) ' docs/experiment/parity.md`

Expected: clean; `31` — no row is Missing.

- [ ] **Step 5: Commit**

```bash
git add README.md CONTEXT.md docs/adr docs/experiment/parity.md
git commit -m "docs: Add the quickstart and record the app in the docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: Close out Plan 3

- [ ] **Step 1: Every gate and profile**

Run: `mise run gate && hk check --all --profile candidate && hk check --all --profile release`

Expected: all pass; `coverage` reports 60 tests.

- [ ] **Step 2: Record the size**

Run: `mise run size`

Expected: `kb: 27 MiB …`; one `docs/experiment/results/tier2-rust-size-*.json`.

```bash
git add docs/experiment/results
git commit -m "test(experiment): Record the release binary size

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Report**

Report to the owner: the gate results, the binary size against Raycast's bundle, the smoke run's RSS, the
parity counts (Same, Adapted, Better), and anything Task 13 Step 5 noted.

## Findings for Plan 4

- The tier 3 harness must post keys with CGEvent (`tmp/key.swift`, fact 1), and measure the panel against
  Raycast both warm, from the same harness.
- Tier 2 RSS for `kb` should be read idle (hidden), open, and after 100 queries, as Raycast was in Plan 1, with
  `bench/probes/rss.sh` and the pattern `^target/release/kb$` (or the `.app` path once packaged).
- Plan 2's finding stands: `search-engine` reads columns by name; measure before changing.
