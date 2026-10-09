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

use gpui_kit::component::{Theme, ThemeMode};

use crate::config::Config;

/// Starts in the dark theme, as a launcher panel over other windows usually is. Every colour the
/// app draws comes from the theme, so a light theme only needs this call changed.
pub fn init_theme(cx: &mut gpui_kit::App) {
    Theme::change(ThemeMode::Dark, None, cx);
}

/// Starts the app with `config` and blocks until it quits.
pub fn run(config: Config) {
    gpui_kit::application()
        .with_assets(gpui_kit::assets::Assets)
        .run(move |cx| {
            gpui_kit::init(cx);
            init_theme(cx);
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
