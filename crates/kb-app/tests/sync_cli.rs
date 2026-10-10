//! `kb --sync`: the built binary rebuilds the index under `HOME` without opening a window.

#![expect(clippy::unwrap_used, reason = "a fixture that cannot be built is a failed test")]

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

fn sync_under(home: &Path, sources: &Path) -> Output {
    fs::create_dir_all(home.join(".config/kb")).unwrap();
    fs::write(
        home.join(".config/kb/config.toml"),
        format!("sources_path = \"{}\"\n", sources.display()),
    )
    .unwrap();
    Command::new(env!("CARGO_BIN_EXE_kb"))
        .arg("--sync")
        .env("HOME", home)
        .output()
        .unwrap()
}

#[test]
fn syncs_the_configured_sources_into_the_data_directory() {
    let home = tempfile::tempdir().unwrap();
    let sample = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../kb-domain/tests/fixtures/sample")
        .canonicalize()
        .unwrap();

    let output = sync_under(home.path(), &sample);

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(output.status.success(), "{stderr}");
    assert!(stderr.contains("kb: indexed "), "{stderr}");
    assert!(
        home.path()
            .join("Library/Application Support/kb-native/kb.db")
            .is_file()
    );
}

#[test]
fn fails_when_the_sources_directory_is_missing() {
    let home = tempfile::tempdir().unwrap();

    let output = sync_under(home.path(), &home.path().join("nowhere"));

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(!output.status.success());
    assert!(stderr.contains("cannot read the sources directory"), "{stderr}");
}
