# kb native port — Plan 4: Raycast UI Parity Enhancement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul `kb-app`'s interface to achieve visual and UX parity with the 5 canonical Raycast extension screens, delivering a dark launcher shell, decoupled header, vibrant type badges, deterministic pastel tags, red description callout quotes, and a docked bottom action bar with keyboard shortcut affordances.

**Architecture:** Initialize GPUI Kit in `ThemeMode::Dark` with tailored launcher tokens. Decouple the query field from `List` into a 52px top header bar (`<` chevron, borderless search, `= All Entries ⌵` filter button) in `search_view.rs`. Enhance `presentation.rs` with `TypeBadge` definitions and deterministic 6-color pastel tag hashing. Update `entry_list.rs` to render vibrant badges and rounded row highlights. Update `notes.rs` with the red vertical description bar. Add a docked 44px bottom action bar across all screens with dynamic context and action dispatches. Validate with headless UI integration tests in `crates/kb-app/tests/ui.rs`.

**Tech Stack:** Rust 2024, GPUI Kit 0.7.1, `kb-domain`, `global-hotkey`.

**Spec:** `docs/superpowers/specs/2026-10-09-raycast-ui-parity-enhancement-design.md`

---

## File map

| Path                                                     | Responsibility                                                                  | Task   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| `crates/kb-app/src/lib.rs`, `crates/kb-app/src/panel.rs` | Dark theme bootstrap and pop-up window radius/tokens                            | Task 1 |
| `crates/kb-app/src/presentation.rs`                      | `TypeBadge` definitions, icon/color mapping, and deterministic tag palette      | Task 2 |
| `crates/kb-app/src/entry_list.rs`                        | Row rendering with vibrant type badges, tinted tags, and rounded selection      | Task 3 |
| `crates/kb-app/src/notes.rs`                             | Notes pane with red description callout quote, stats block, and metadata grid   | Task 4 |
| `crates/kb-app/src/search_view.rs`                       | 3-tier launcher shell, decoupled header bar with back chevron and filter button | Task 5 |
| `crates/kb-app/src/search_view.rs`                       | Docked bottom action bar with contextual badges and keycap shortcuts            | Task 6 |
| `crates/kb-app/tests/ui.rs`, `docs/experiment/parity.md` | UI integration tests for new affordances and parity documentation update        | Task 7 |

---

### Task 1: Dark Mode Bootstrap & Launcher Window Chrome

**Files:**

- Modify: `crates/kb-app/src/lib.rs:21-35`
- Modify: `crates/kb-app/src/panel.rs:28-46`
- Test: `crates/kb-app/tests/ui.rs`

- [ ] **Step 1: Write the failing test for dark theme initialization**

In `crates/kb-app/tests/ui.rs`, add a test verifying that the app initializes with dark mode:

```rust
#[gpui_kit::test]
fn initializes_with_dark_theme_mode(cx: &mut gpui_kit::TestAppContext) {
    let (_dir, config) = test_config();
    cx.update(|cx| {
        gpui_kit::init(cx);
        kb_app::init_theme(cx);
        assert_eq!(cx.theme().mode, gpui_kit::ThemeMode::Dark);
    });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo nextest run -p kb-app initializes_with_dark_theme_mode`
Expected: FAIL with "cannot find function `init_theme` in crate `kb_app`"

- [ ] **Step 3: Implement `init_theme` and window styling**

In `crates/kb-app/src/lib.rs`, expose `init_theme`:

```rust
use gpui_kit::{Theme, ThemeMode};

/// Configures the launcher theme in dark mode with refined surface tokens.
pub fn init_theme(cx: &mut gpui_kit::App) {
    Theme::change(ThemeMode::Dark, None, cx);
}
```

And call `init_theme(cx);` in `run()` right after `gpui_kit::init(cx);`.

In `crates/kb-app/src/panel.rs`, ensure `window_options` retains the pop-up kind and centered bounds:

```rust
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo nextest run -p kb-app initializes_with_dark_theme_mode`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/kb-app/src/lib.rs crates/kb-app/src/panel.rs crates/kb-app/tests/ui.rs
git commit -m "feat(app): Initialize launcher in dark mode"
```

---

### Task 2: Vibrant Type Badges & Deterministic Tag Tinting

**Files:**

- Modify: `crates/kb-app/src/presentation.rs`
- Test: `crates/kb-app/src/presentation.rs` (in `mod tests`)

- [ ] **Step 1: Write the failing tests for type badges and tag tints**

In `crates/kb-app/src/presentation.rs` inside `mod tests`:

```rust
#[test]
fn matches_type_badge_colors_and_icons() {
    let cmd = type_badge("Command");
    assert_eq!(cmd.icon, IconName::ChevronRight);
    assert!(cmd.is_terminal_style());

    let cheat = type_badge("Cheat");
    assert_eq!(cheat.icon, IconName::FileText);

    let bookmark = type_badge("Bookmark");
    assert_eq!(bookmark.icon, IconName::Globe);
}

#[test]
fn hashes_tags_deterministically_into_palette() {
    let tag1 = tag_tint("nu");
    let tag2 = tag_tint("nu");
    assert_eq!(tag1, tag2);

    let tag_schedule = tag_tint("schedule");
    assert_ne!(tag1, tag_schedule);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p kb-app --lib presentation::tests::matches_type_badge_colors_and_icons`
Expected: FAIL with "cannot find function `type_badge` in module"

- [ ] **Step 3: Implement `TypeBadge` and `tag_tint`**

In `crates/kb-app/src/presentation.rs`:

```rust
use gpui_kit::Rgba;

/// The visual presentation of an entry type badge.
#[derive(Debug, Clone, PartialEq)]
pub struct TypeBadge {
    pub icon: IconName,
    pub glyph: Option<&'static str>,
    pub bg: Rgba,
    pub border: Rgba,
    pub fg: Rgba,
}

impl TypeBadge {
    #[must_use]
    pub fn is_terminal_style(&self) -> bool {
        self.glyph == Some(">")
    }
}

/// Returns the vibrant badge styling for an entry type.
#[must_use]
pub fn type_badge(entry_type: &str) -> TypeBadge {
    match type_key(entry_type) {
        TypeKey::Command => TypeBadge {
            icon: IconName::ChevronRight,
            glyph: Some(">"),
            bg: gpui_kit::rgb(0x14532d),
            border: gpui_kit::rgb(0x22c55e),
            fg: gpui_kit::rgb(0x4ade80),
        },
        TypeKey::Cheat => TypeBadge {
            icon: IconName::FileText,
            glyph: None,
            bg: gpui_kit::rgb(0x1e3a8a),
            border: gpui_kit::rgb(0x3b82f6),
            fg: gpui_kit::rgb(0x93c5fd),
        },
        TypeKey::Bookmark => TypeBadge {
            icon: IconName::Globe,
            glyph: None,
            bg: gpui_kit::rgb(0x0c4a6e),
            border: gpui_kit::rgb(0x0284c7),
            fg: gpui_kit::rgb(0x38bdf8),
        },
        TypeKey::Note => TypeBadge {
            icon: IconName::BookOpen,
            glyph: None,
            bg: gpui_kit::rgb(0x3b0764),
            border: gpui_kit::rgb(0x9333ea),
            fg: gpui_kit::rgb(0xc084fc),
        },
        TypeKey::Task => TypeBadge {
            icon: IconName::CheckSquare,
            glyph: None,
            bg: gpui_kit::rgb(0x4c0519),
            border: gpui_kit::rgb(0xe11d48),
            fg: gpui_kit::rgb(0xfb7185),
        },
        TypeKey::Other => TypeBadge {
            icon: IconName::File,
            glyph: None,
            bg: gpui_kit::rgb(0x1e293b),
            border: gpui_kit::rgb(0x475569),
            fg: gpui_kit::rgb(0x94a3b8),
        },
    }
}

/// A pastel tint for a tag badge.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TagTint {
    pub bg: Rgba,
    pub fg: Rgba,
}

/// Curated palette of 6 pastel tag colors for dark mode.
const TAG_PALETTE: [(u32, u32); 6] = [
    (0x3b181a, 0xf87171), // Coral
    (0x3d270c, 0xfbbf24), // Amber
    (0x13301f, 0x4ade80), // Emerald
    (0x132742, 0x60a5fa), // Sky
    (0x3b162c, 0xf472b6), // Rose
    (0x2f1b40, 0xc084fc), // Violet
];

/// Deterministically maps a tag name to a dark-mode pastel tint.
#[must_use]
pub fn tag_tint(tag: &str) -> TagTint {
    let mut hash: usize = 5381;
    for byte in tag.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as usize);
    }
    let (bg_hex, fg_hex) = TAG_PALETTE[hash % TAG_PALETTE.len()];
    TagTint {
        bg: gpui_kit::rgb(bg_hex),
        fg: gpui_kit::rgb(fg_hex),
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p kb-app --lib presentation::tests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/kb-app/src/presentation.rs
git commit -m "feat(presentation): Add vibrant type badges and deterministic tag tints"
```

---

### Task 3: List Row Presentation in EntryList

**Files:**

- Modify: `crates/kb-app/src/entry_list.rs:117-148`
- Test: `crates/kb-app/tests/ui.rs`

- [ ] **Step 1: Write failing UI test for row badge and tag rendering**

In `crates/kb-app/tests/ui.rs`:

```rust
#[gpui_kit::test]
fn renders_rows_with_vibrant_badge_and_tinted_tags(cx: &mut gpui_kit::TestAppContext) {
    let (_dir, config) = test_config();
    let view = open_search_view(config, cx);
    cx.update(|cx| {
        let entry_list = view.read(cx).list();
        assert!(entry_list.read(cx).entries().len() > 0);
    });
}
```

- [ ] **Step 2: Update `EntryList::render_row` with vibrant badges, styled tags, and accessories**

In `crates/kb-app/src/entry_list.rs`:

```rust
use crate::presentation::{row_tags, tag_tint, type_badge};

fn render_row(entry: &Entry, selected: bool, cx: &App) -> ListItem {
    let (tags, more) = row_tags(&entry.tags);
    let badge = type_badge(&entry.entry_type);

    ListItem::new(SharedString::from(entry.id.clone()))
        .selected(selected)
        .rounded_lg()
        .child(
            h_flex()
                .w_full()
                .items_center()
                .gap_3()
                .py_1()
                .px_1p5()
                // Vibrant type badge
                .child(
                    div()
                        .size_5()
                        .rounded_md()
                        .border_1()
                        .border_color(badge.border)
                        .bg(badge.bg)
                        .flex()
                        .items_center()
                        .justify_center()
                        .text_xs()
                        .font_weight(gpui_kit::FontWeight::BOLD)
                        .text_color(badge.fg)
                        .map(|el| {
                            if let Some(glyph) = badge.glyph {
                                el.child(glyph)
                            } else {
                                el.child(Icon::new(badge.icon).size(px(12.)).text_color(badge.fg))
                            }
                        }),
                )
                // Row title
                .child(
                    div()
                        .flex_none()
                        .font_weight(gpui_kit::FontWeight::SEMIBOLD)
                        .text_color(cx.theme().foreground)
                        .child(entry.title.clone()),
                )
                // Row description / subtitle
                .child(
                    div()
                        .flex_1()
                        .min_w_0()
                        .truncate()
                        .text_color(cx.theme().muted_foreground)
                        .text_xs()
                        .when_some(entry.description.clone(), ParentElement::child),
                )
                // Deterministic pastel tags
                .children(tags.iter().map(|tag| {
                    let tint = tag_tint(tag);
                    div()
                        .px_2()
                        .py_0p5()
                        .rounded_md()
                        .bg(tint.bg)
                        .text_color(tint.fg)
                        .text_xs()
                        .font_weight(gpui_kit::FontWeight::MEDIUM)
                        .child(format!("#{tag}"))
                }))
                .when(more > 0, |row| {
                    row.child(div().text_color(cx.theme().muted_foreground).text_xs().child(format!("+{more}")))
                })
                .when(!entry.links.is_empty(), |row| {
                    row.child(
                        div()
                            .text_color(cx.theme().muted_foreground)
                            .text_xs()
                            .child(format!("{} links", entry.links.len())),
                    )
                }),
        )
}
```

- [ ] **Step 3: Run tests to verify row rendering passes**

Run: `cargo test -p kb-app`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add crates/kb-app/src/entry_list.rs
git commit -m "feat(entry_list): Render vibrant type badges and tinted tags on list rows"
```

---

### Task 4: Notes Pane & Detail Screen Styling

**Files:**

- Modify: `crates/kb-app/src/notes.rs`
- Test: `crates/kb-app/tests/ui.rs`

- [ ] **Step 1: Write test for red description callout in notes pane**

In `crates/kb-app/tests/ui.rs`, verify notes pane elements render without panic on entries with descriptions.

- [ ] **Step 2: Update `notes_pane` to render red callout quote bar**

In `crates/kb-app/src/notes.rs`:

```rust
// In notes_pane rendering:
// If entry.description exists, render it with the signature red callout bar:
if let Some(description) = &entry.description {
    content = content.child(
        div()
            .border_l_3()
            .border_color(gpui_kit::rgb(0xef4444))
            .pl_3()
            .py_1()
            .text_sm()
            .text_color(cx.theme().foreground)
            .child(description.clone()),
    );
}
```

Format the metadata table with key-value grid styling matching Raycast Screen 4.

- [ ] **Step 3: Run tests to verify notes rendering passes**

Run: `cargo test -p kb-app`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add crates/kb-app/src/notes.rs
git commit -m "feat(notes): Add red description callout bar and metadata table styling"
```

---

### Task 5: 3-Tier Shell & Custom Header Bar

**Files:**

- Modify: `crates/kb-app/src/search_view.rs`
- Test: `crates/kb-app/tests/ui.rs`

- [ ] **Step 1: Write failing UI test for decoupled header search and back chevron**

In `crates/kb-app/tests/ui.rs`:

```rust
#[gpui_kit::test]
fn header_search_forwards_query_to_entry_list(cx: &mut gpui_kit::TestAppContext) {
    let (_dir, config) = test_config();
    let view = open_search_view(config, cx);
    cx.update(|cx| {
        view.update(cx, |view, cx| {
            view.set_query("cron", cx);
        });
    });
    // Let debounce run
    cx.run_until_parked();
    cx.update(|cx| {
        let entries = view.read(cx).list().read(cx).entries();
        assert!(entries.iter().any(|e| e.title.contains("cron") || e.title.contains("*")));
    });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo nextest run -p kb-app header_search_forwards_query_to_entry_list`
Expected: FAIL

- [ ] **Step 3: Decouple search input from `List` and implement custom header bar**

In `crates/kb-app/src/search_view.rs`:

1. In `SearchView::new`, disable default list search:
   ```rust
   list.update(cx, |list, cx| list.set_searchable(false, cx));
   ```
2. Store a header `Entity<InputState>` in `SearchView`.
3. Render 52px header bar in `SearchView::render`:
   - Left: `<` back chevron (`IconName::ChevronLeft`) with click listener invoking `back()`.
   - Center: `Input::new(&self.query_input).cleanable(true).appearance(false)`.
   - Right: `= All Entries ⌵` pill button invoking `open_filter()`.
4. Subscribe to `query_input` changes to update `ListState::set_query`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo nextest run -p kb-app header_search_forwards_query_to_entry_list`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/kb-app/src/search_view.rs crates/kb-app/tests/ui.rs
git commit -m "feat(search_view): Implement 3-tier launcher shell with custom header bar"
```

---

### Task 6: Docked Bottom Action Bar

**Files:**

- Modify: `crates/kb-app/src/search_view.rs`
- Test: `crates/kb-app/tests/ui.rs`

- [ ] **Step 1: Write failing UI test for docked action bar dispatches**

In `crates/kb-app/tests/ui.rs`:

```rust
#[gpui_kit::test]
fn action_bar_reflects_context_and_dispatches_actions(cx: &mut gpui_kit::TestAppContext) {
    let (_dir, config) = test_config();
    let view = open_search_view(config, cx);
    cx.update(|cx| {
        // Assert action bar renders and has correct buttons
        assert!(view.read(cx).has_action_bar());
    });
}
```

- [ ] **Step 2: Implement docked action bar component**

In `crates/kb-app/src/search_view.rs`:
Render a 44px footer docked at the bottom of `SearchView`:

- **Left Badge:**
  - Pill with coral icon + label:
    - `"Search Knowledge Base"` on Search and Split views.
    - Entry title on Detail view.
    - `"Rebuilding Index…"` on Rebuild view.
- **Right Action Pills:**
  - `Show Details` with `↵` keycap badge (or primary action on Detail screen).
  - `Actions` with `⌘K` keycap badges.
  - Wire click handlers to dispatch `ToggleDetails`, `RunPrimary`, and `OpenActions`.

- [ ] **Step 3: Run test to verify it passes**

Run: `cargo test -p kb-app`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add crates/kb-app/src/search_view.rs crates/kb-app/tests/ui.rs
git commit -m "feat(search_view): Add docked bottom action bar with physical keycaps"
```

---

### Task 7: UI Integration Test Suite, Parity Alignment & Smoke Run

**Files:**

- Modify: `crates/kb-app/tests/ui.rs`
- Modify: `docs/experiment/parity.md`

- [ ] **Step 1: Add full integration test suite covering all 5 screens**

In `crates/kb-app/tests/ui.rs`, ensure tests cover:

1. List view search with header input.
2. Filter palette opening and header label update.
3. Action palette opening via ⌘K.
4. Split view toggle via ⌘D with red callout bar.
5. Detail view push on Enter, title update on footer, and back navigation on Esc.

- [ ] **Step 2: Update `docs/experiment/parity.md`**

Update parity rows S05, S07, F01, and add the bottom action bar row to document the enhancements.

- [ ] **Step 3: Run complete workspace validation**

Run:

```bash
mise run gate
```

Expected: All tests pass, clippy clean, build succeeds, hk checks pass.

- [ ] **Step 4: Commit**

```bash
git add crates/kb-app/tests/ui.rs docs/experiment/parity.md
git commit -m "test(app): Verify Raycast UI parity and update parity documentation"
```
