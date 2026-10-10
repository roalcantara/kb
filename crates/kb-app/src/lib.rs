//! The kb search panel: a resident GPUI Kit app over `kb-domain`, opened by a global hotkey.
//!
//! `main` only resolves the configuration and calls [`run`]; everything else is a module here,
//! so the UI integration tests build the same views the app shows. Only what `main` and those
//! tests use is public.

#![warn(missing_docs)]

pub mod cli;
pub mod config;
pub mod entry_list;
mod filter;
#[cfg(test)]
mod fixture;
mod notes;
pub mod palette;
mod panel;
mod presentation;
pub mod search_view;
mod sync_view;
mod trace;

use gpui_kit::component::Theme;

use crate::config::Config;

/// The bundle identifier, shared by the `.app`'s `Info.plist` and GPUI's app identity.
pub const APP_ID: &str = "dev.roalcantara.kb";

/// Follows the system's light or dark appearance. Every colour the app draws comes from the
/// theme, so both work; `SearchView` re-syncs whenever the appearance changes.
pub fn init_theme(cx: &mut gpui_kit::App) {
    Theme::sync_system_appearance(None, cx);
}

/// Starts the app and blocks until it quits. `notices` are shown in the panel once it opens:
/// problems found before there was a window to report them in, such as unreadable preferences.
/// `trace` logs the show and keystroke latencies to stderr (`kb --trace`).
pub fn run(config: Config, notices: Vec<String>, trace: bool) {
    gpui_kit::application()
        .with_assets(gpui_kit::assets::Assets)
        .run(move |cx| {
            gpui_kit::init(cx);
            cx.set_app_identity(APP_ID, "kb");
            init_theme(cx);
            if trace {
                trace::enable(cx);
            }
            if let Err(error) = panel::open(config, notices, cx) {
                #[expect(
                    clippy::print_stderr,
                    reason = "the window failed to open: stderr is the only channel left"
                )]
                {
                    eprintln!("kb: {error}");
                }
                cx.quit();
            }
        });
}
