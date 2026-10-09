//! UI integration tests: the production `SearchView` in a headless window over the committed
//! sample corpus, driven by real key events.

#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use gpui_kit::component::{ActiveTheme as _, ThemeMode};
use gpui_kit::test::TestWindowExt as _;
use gpui_kit::{
    AnyWindowHandle, App, AppContext as _, Bounds, Entity, Point, TestAppContext, Window, WindowBounds, WindowOptions,
    px, size,
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

fn selected_title(view: &Entity<SearchView>, cx: &mut TestAppContext) -> Option<String> {
    cx.read(|cx| {
        view.read(cx)
            .list()
            .read(cx)
            .delegate()
            .selected_entry()
            .map(|e| e.title.clone())
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

#[gpui_kit::test]
fn initializes_with_dark_theme_mode(cx: &mut gpui_kit::TestAppContext) {
    cx.update(|cx| {
        gpui_kit::init(cx);
        kb_app::init_theme(cx);
        assert_eq!(cx.theme().mode, ThemeMode::Dark);
    });
}

/// Renders a frame, then acts on the window.
fn act(cx: &mut TestAppContext, window: AnyWindowHandle, action: impl FnOnce(&mut Window, &mut App)) {
    cx.update_window(window, |_, window, cx| {
        window.render_frame(cx);
        action(window, cx);
    })
    .unwrap();
}

/// Types `text` at the focused element.
fn type_text(cx: &mut TestAppContext, window: AnyWindowHandle, text: &'static str) {
    act(cx, window, |window, cx| window.input(text, cx));
}

/// Presses the named key.
fn press(cx: &mut TestAppContext, window: AnyWindowHandle, key: &'static str) {
    act(cx, window, |window, cx| window.press(key, cx));
}

/// Clicks the element with this id.
fn click(cx: &mut TestAppContext, window: AnyWindowHandle, id: &'static str) {
    act(cx, window, |window, cx| window.click(id, cx));
}

/// Opens the panel over the sample corpus and searches for `query`. Keep the home alive.
fn open_with_query(
    cx: &mut TestAppContext,
    query: &'static str,
) -> (tempfile::TempDir, AnyWindowHandle, Entity<SearchView>) {
    let home = tempfile::tempdir().unwrap();
    let (window, view) = open(cx, sample_config(home.path()));
    type_text(cx, window, query);
    settle(cx);
    (home, window, view)
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
    let (_home, window, _view) = open_with_query(cx, "kubectl");
    press(cx, window, "secondary-enter");
    let copied = cx.read_from_clipboard().and_then(|item| item.text());
    assert_eq!(copied.as_deref(), Some("kubectl get pods -A"));
}

#[gpui_kit::test]
fn copies_the_title_from_the_action_palette(cx: &mut TestAppContext) {
    let (_home, window, _view) = open_with_query(cx, "rebase");
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
    let (_home, window, _view) = open_with_query(cx, "explicit");
    press(cx, window, "enter");
    press(cx, window, "enter");
    let copied = cx.read_from_clipboard().and_then(|item| item.text());
    assert_eq!(copied.as_deref(), Some("./scripts/run.sh --verbose"));
}

#[gpui_kit::test]
fn runs_one_query_after_typing_settles(cx: &mut TestAppContext) {
    let home = tempfile::tempdir().unwrap();
    let (window, view) = open(cx, sample_config(home.path()));
    type_text(cx, window, "docker");
    cx.run_until_parked();
    assert_eq!(titles(&view, cx).len(), 12, "nothing runs before the debounce elapses");
    settle(cx);
    assert_eq!(titles(&view, cx), ["docker ps -a"]);
}

#[gpui_kit::test]
fn moves_the_selection_with_the_arrow_keys(cx: &mut TestAppContext) {
    let home = tempfile::tempdir().unwrap();
    let (window, view) = open(cx, sample_config(home.path()));
    let all = titles(&view, cx);
    assert_eq!(selected_title(&view, cx).as_ref(), all.first());
    press(cx, window, "down");
    press(cx, window, "down");
    assert_eq!(selected_title(&view, cx).as_ref(), all.get(2));
    press(cx, window, "up");
    assert_eq!(selected_title(&view, cx).as_ref(), all.get(1));
    press(cx, window, "enter");
    assert!(cx.read(|cx| view.read(cx).is_showing_detail()));
    assert_eq!(selected_title(&view, cx).as_ref(), all.get(1));
}

#[gpui_kit::test]
fn selects_the_first_result_of_a_new_query(cx: &mut TestAppContext) {
    let home = tempfile::tempdir().unwrap();
    let (window, view) = open(cx, sample_config(home.path()));
    press(cx, window, "down");
    press(cx, window, "down");
    type_text(cx, window, "kubectl");
    settle(cx);
    assert_eq!(selected_title(&view, cx).as_deref(), Some("All pods"));
}

#[gpui_kit::test]
fn opens_details_with_enter_in_the_list_without_running_the_primary_action(cx: &mut TestAppContext) {
    let (_home, window, view) = open_with_query(cx, "kubectl");
    cx.write_to_clipboard(gpui_kit::ClipboardItem::new_string("before".into()));
    press(cx, window, "enter");
    assert!(cx.read(|cx| view.read(cx).is_showing_detail()));
    let clipboard = cx.read_from_clipboard().and_then(|item| item.text());
    assert_eq!(clipboard.as_deref(), Some("before"));
}

#[gpui_kit::test]
fn the_action_bar_opens_details_and_runs_the_primary_action(cx: &mut TestAppContext) {
    let (_home, window, view) = open_with_query(cx, "kubectl");
    click(cx, window, "footer-primary-action");
    assert!(cx.read(|cx| view.read(cx).is_showing_detail()));
    click(cx, window, "footer-primary-action");
    let copied = cx.read_from_clipboard().and_then(|item| item.text());
    assert_eq!(copied.as_deref(), Some("kubectl get pods -A"));
}
