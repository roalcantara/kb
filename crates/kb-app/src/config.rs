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
        Ok(Self::from_preferences(parsed, home, data_dir))
    }

    /// The locations without preferences: the Raycast sources directory and the app's index.
    #[must_use]
    pub fn defaults(home: &Path, data_dir: &Path) -> Self {
        Self::from_preferences(Preferences::default(), home, data_dir)
    }

    fn from_preferences(parsed: Preferences, home: &Path, data_dir: &Path) -> Self {
        let sources_dir = parsed
            .sources_path
            .map_or_else(|| home.join(DEFAULT_SOURCES), |path| expand_home(&path, home));
        Self {
            sources_dir,
            database: data_dir.join("kb-native").join("kb.db"),
            preferences: home.join(PREFERENCES),
        }
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
    fn falls_back_to_the_defaults() {
        let home = home_with(Some("sources_path = \"~/elsewhere\"\n"));
        let config = Config::defaults(home.path(), Path::new("/data"));
        assert_eq!(config.sources_dir(), home.path().join(".config/kodexb/sources"));
        assert_eq!(config.preferences(), home.path().join(".config/kb/config.toml"));
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
