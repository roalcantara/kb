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
