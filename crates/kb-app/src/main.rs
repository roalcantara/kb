//! `kb [--trace | --sync]`: resolves the configuration, then runs the panel or rebuilds the index.

use std::fmt::Display;
use std::io;
use std::process::ExitCode;

use kb_app::cli::{self, Mode};
use kb_app::config::Config;

fn main() -> ExitCode {
    let mode = match cli::parse(std::env::args().skip(1)) {
        Ok(mode) => mode,
        Err(error) => return fail(error),
    };
    let (Some(home), Some(data)) = (dirs::home_dir(), dirs::data_dir()) else {
        return fail("cannot find the home and data directories");
    };
    match mode {
        // No panel shows a notice in a headless sync, so unreadable preferences stop it.
        Mode::Sync => match Config::load(&home, &data) {
            Ok(config) => match cli::sync(&config, &mut io::stderr().lock()) {
                Ok(()) => ExitCode::SUCCESS,
                Err(error) => fail(error),
            },
            Err(error) => fail(error),
        },
        Mode::Panel { trace } => {
            // Unreadable preferences do not stop the app: it starts on the defaults and says why in
            // the panel, where someone who launched it from Finder will see it.
            let (config, notices) = match Config::load(&home, &data) {
                Ok(config) => (config, Vec::new()),
                Err(error) => (
                    Config::defaults(&home, &data),
                    vec![format!("Using the default sources: {error}")],
                ),
            };
            kb_app::run(config, notices, trace);
            ExitCode::SUCCESS
        }
    }
}

/// Reports `error` and fails: without a window, stderr is the only channel.
fn fail(error: impl Display) -> ExitCode {
    #[expect(clippy::print_stderr, reason = "no window exists: stderr is the only channel")]
    {
        eprintln!("kb: {error}");
    }
    ExitCode::FAILURE
}
