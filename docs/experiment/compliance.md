# Compliance

The checklists the port is held to, each item with its evidence. `xtask report` counts the checked items per section;
an unchecked item says why and what would close it. Sources: the GPUI Kit Coding Guides ("Implementation checklist",
"Theme and styling", "Events, actions, and focus", "Performance rules"), the GPUI Kit Design Guides ("Accessibility
checklist", "Interface language"), and the rust-best-practices quick reference.

## GPUI Kit coding guides

- [x] State and side-effect ownership are explicit: `SearchView` owns the screen and the panes; `EntryList` owns the
      query, filter, page and connection; the sync runs on the background executor and reports through `SyncFinished`
      (`search_view.rs`, `entry_list.rs`, `sync_view.rs`).
- [x] `RenderOnce` versus `Entity<T>` is deliberate: views with state and focus are entities (`SearchView`,
      `SyncView`, the list); the notes pane is a function returning an element (`notes.rs`).
- [x] Repeated elements have stable domain-based ids: the notes `TextView` is keyed by the entry id; sync report rows
      by their path; list rows by the List's own index model, which is virtualized (`notes.rs`, `sync_view.rs`).
- [x] Theme tokens replace visual literals: no hex, `rgb` or `hsla` in the app; hues map to `theme.red` … `theme.magenta`
      (`entry_list::hue_color`); the split uses `rems` (`search_view::LIST_WIDTH_REMS`). **Exception:** the window frame,
      `px(860.) × px(520.)`, is in platform points, documented at `panel::window_options`.
- [x] Keyboard actions, focus and overlays work together: every action has a binding in a context
      (`palette::key_bindings`); the up and down keys are captured from the search field; the palettes open in `Root`
      and focus returns after them (`task_t3_filters_by_a_type_and_a_tag_with_two_picks` presses ⌘P again after a
      pick).
- [x] Loading, empty, error and cancellation paths are represented: empty states for no index and no match
      (`EntryList::render_empty`); rebuild stopped and failed states (`SyncStatus`); unreadable preferences and a taken
      hotkey become notifications (`main.rs`, `panel::open`); a failed filter read too (`search_view.rs`).
- [x] Long data sets use a virtualized component: `List`, paged 50 at a time like Raycast (`EntryList::load_more`).
- [x] Public API additions preserve direction and encapsulation: `kb-domain` has no UI dependency (hk
      `domain-purity`); `kb-app` exposes only what `main` and its UI tests use (`lib.rs`).
- [x] Tests prove behaviour at the right layer: domain units and goldens; presentation units; UI tests that press keys
      in a real window (`tests/ui.rs`).
- [x] No state mutation or `notify` in `render`; entities and subscriptions are built once in `SearchView::new`.
- [x] Root is the first level of the window and `gpui_kit::init` runs once before any view (`lib.rs::run`).
- [x] The app follows the system appearance, and updates when it changes (`init_theme`; `observe_window_appearance`;
      `follows_the_system_appearance`).
- [x] Async work is cancellable: the debounce task is dropped by the next query; a rebuild stops on Esc and rolls back
      (`entry_list::perform_search`, `SyncView::cancel`).

## GPUI Kit design guides

- [x] Every action is reachable and operable by keyboard: the action palette lists every action of the selection,
      and each has a shortcut (`palette::entry_palette`).
- [x] Focus order follows the task, and focus returns after overlays (see the coding-guides item on focus).
- [x] Icon-only controls have names and tooltips: the back button has an accessibility label and the "Back (Esc)"
      tooltip; the footer buttons carry their labels and key hints (`search_view::render_header`, `render_footer`).
- [x] Status is not told by colour alone: type badges carry a glyph and the type in the metadata; tags carry their
      `#name`; rebuild states have a title and text.
- [x] Copy is sentence case, with an ellipsis only on commands that ask for more input: "Open in browser",
      "Copy command snippet", "Rebuild index", "Clear all filters" (`presentation.rs`, `palette.rs`, `filter.rs`).
- [x] Errors read as what happened and what to do: "Couldn’t register ⌥K: … Another app may be using it."
- [x] An app-level Quit command exists: ⌘Q, and "Quit kb" in the action palette (`palette::Quit`).
- [x] Content remains usable at larger text: the list width is in rems, so it grows with the base font.
- [x] Assistive technology can read the controls and the list: GPUI exposes them through AccessKit once a client
      asks. The back, filter and footer buttons and the search field carry their names; each list row is named by its
      visible text — title, type, description, tags (`presentation::row_label`, `names_a_row_by_its_visible_text`).
      Checked in the macOS accessibility tree of the packaged app; the test platform builds no tree, so no UI test can.
- [ ] Assistive technology can read the notes. GPUI Kit's `TextView` sets no accessibility role (0.7.1), so the notes
      pane is invisible to VoiceOver. Upstream: a role on `TextView`; until then the row label carries the description.

## Rust best practices

- [x] Fallible operations return `Result`; no `unwrap` or `expect` outside tests (`clippy::unwrap_used` and
      `expect_used` are denied by the gate, `clippy.toml` allows them only in tests).
- [x] `thiserror` for every error type (`SyncError`, `ConfigError`, `PanelError`, `xtask::Error`); no `anyhow`.
- [x] `#[expect(lint, reason = …)]` instead of `#[allow]`: no `allow` attribute remains in the crates.
- [x] Clippy `pedantic` with `-D warnings` on all targets, in the gate (`mise run gate`).
- [x] Public items are documented: `missing_docs` on both library crates, an error under the gate's `-D warnings`;
      `cargo doc` with `-D warnings`.
- [x] Doc tests show the public API: the crate example syncs and searches; the query and id helpers have examples
      (`kb_domain`, `query.rs`, `entry.rs`, `markdown.rs`); the gate runs them (`cargo test --doc`).
- [x] Tests are named for the behaviour they prove (`opens_details_with_enter_in_the_list_without_running_the_primary_action`).
- [x] Benchmarks run in release with LTO (`kb-bench`, `profile.release`).
- [x] No `TODO` without an issue: none in the crates.
- [x] No unsafe code: `unsafe_code = "forbid"` for the workspace.
- [x] Static dispatch by default; `dyn` only where values are heterogeneous: palette rows hold `Box<dyn Action>`,
      the GPUI dispatch type (`palette.rs`), and `kb-bench` boxes its errors at the binary's edge.

## Repository conventions

- [x] Tool versions pinned in `mise.toml`, including the packager and the line counter.
- [x] Dependencies audited by `cargo deny`; exceptions recorded with reasons (ADR 0005).
- [x] Every hk step of the Raycast repo has its counterpart or a recorded reason (`hk.pkl`).
- [x] The release binary stays within its size budget (`tools/size/budget`, `mise run size`).
- [x] A signed, installable `.app` is built by one task (`mise run package`); the bundle id is shared with the app
      identity (`kb_app::APP_ID`).
