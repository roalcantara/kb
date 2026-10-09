//! `kb [--trace]`: resolves the configuration and runs the panel.

use std::process::ExitCode;

use kb_app::config::Config;

fn main() -> ExitCode {
    let (Some(home), Some(data)) = (dirs::home_dir(), dirs::data_dir()) else {
        #[expect(clippy::print_stderr, reason = "no window exists yet: stderr is the only channel")]
        {
            eprintln!("kb: cannot find the home and data directories");
        }
        return ExitCode::FAILURE;
    };
    // Unreadable preferences do not stop the app: it starts on the defaults and says why in the
    // panel, where someone who launched it from Finder will see it.
    let (config, notices) = match Config::load(&home, &data) {
        Ok(config) => (config, Vec::new()),
        Err(error) => (
            Config::defaults(&home, &data),
            vec![format!("Using the default sources: {error}")],
        ),
    };
    let trace = std::env::args().skip(1).any(|arg| arg == "--trace");
    kb_app::run(config, notices, trace);
    ExitCode::SUCCESS
}
