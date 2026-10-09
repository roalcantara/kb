//! Reading `docs/experiment/results/`: the latest run of each kind, and the figures in it.
//!
//! Every result file is named `<kind>-<UTC stamp>.json` (methodology, "Results"); a kind's
//! latest run is the one whose stamp sorts last.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::Error;

/// The results directory, read once.
#[derive(Debug)]
pub struct Results {
    dir: PathBuf,
    names: Vec<String>,
}

impl Results {
    /// Lists `dir`.
    pub fn open(dir: &Path) -> Result<Self, Error> {
        let mut names = Vec::new();
        for entry in fs::read_dir(dir).map_err(|e| Error::io(dir, e))? {
            let entry = entry.map_err(|e| Error::io(dir, e))?;
            if let Some(name) = entry.file_name().to_str() {
                names.push(name.to_owned());
            }
        }
        names.sort();
        Ok(Self {
            dir: dir.to_owned(),
            names,
        })
    }

    /// The latest run of `kind`, if there is one: the file named `<kind>-<stamp>.json`.
    pub fn latest(&self, kind: &str) -> Result<Option<Run>, Error> {
        let Some(name) = self.names.iter().rev().find(|name| is_run_of(name, kind)) else {
            return Ok(None);
        };
        let path = self.dir.join(name);
        let text = fs::read_to_string(&path).map_err(|e| Error::io(&path, e))?;
        let value = serde_json::from_str(&text).map_err(|e| Error::Json(path.clone(), e))?;
        Ok(Some(Run {
            name: name.clone(),
            value,
        }))
    }
}

/// Whether `name` is `<kind>-YYYYMMDDTHHMMSSZ.json`, so that `tier3-kb` does not match
/// `tier3-kb-action-…`.
fn is_run_of(name: &str, kind: &str) -> bool {
    let Some(stamp) = name.strip_prefix(kind).and_then(|rest| rest.strip_prefix('-')) else {
        return false;
    };
    let Some(stamp) = stamp.strip_suffix(".json") else {
        return false;
    };
    let bytes = stamp.as_bytes();
    bytes.len() == 16
        && bytes[8] == b'T'
        && bytes[15] == b'Z'
        && bytes[..8].iter().chain(&bytes[9..15]).all(u8::is_ascii_digit)
}

/// One result file.
#[derive(Debug)]
pub struct Run {
    /// Its file name, cited in the report.
    pub name: String,
    /// Its contents.
    pub value: Value,
}

impl Run {
    /// A statistic of the whole run: `stats.<key>`.
    pub fn stat(&self, key: &str) -> Option<f64> {
        stat(&self.value, key)
    }

    /// A statistic of one metric of a multi-metric run: `metrics.<metric>.stats.<key>`.
    pub fn metric(&self, metric: &str, key: &str) -> Option<f64> {
        stat(self.value.get("metrics")?.get(metric)?, key)
    }

    /// A tier 1 case by name.
    pub fn case(&self, name: &str) -> Option<&Value> {
        self.value
            .get("cases")?
            .as_array()?
            .iter()
            .find(|case| case.get("name").and_then(Value::as_str) == Some(name))
    }

    /// The names of every tier 1 case, in run order.
    pub fn case_names(&self) -> Vec<&str> {
        self.value
            .get("cases")
            .and_then(Value::as_array)
            .map(|cases| cases.iter().filter_map(|c| c.get("name")?.as_str()).collect())
            .unwrap_or_default()
    }

    /// A number at a path of keys.
    pub fn number(&self, path: &[&str]) -> Option<f64> {
        path.iter().try_fold(&self.value, |value, key| value.get(key))?.as_f64()
    }

    /// A string at a path of keys.
    pub fn text(&self, path: &[&str]) -> Option<&str> {
        path.iter().try_fold(&self.value, |value, key| value.get(key))?.as_str()
    }
}

/// `stats.<key>` of a value.
pub fn stat(value: &Value, key: &str) -> Option<f64> {
    value.get("stats")?.get(key)?.as_f64()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_a_kind_only_with_a_stamp_after_it() {
        assert!(is_run_of("tier3-kb-20261009T181619Z.json", "tier3-kb"));
        assert!(!is_run_of("tier3-kb-action-20261009T181619Z.json", "tier3-kb"));
        assert!(!is_run_of("tier3-kb-latest.json", "tier3-kb"));
    }

    #[test]
    fn picks_the_latest_run_of_a_kind() {
        let dir = tempfile::tempdir().unwrap();
        for (name, p50) in [
            ("tier2-rust-cpu-all-20261009T100000Z.json", 1),
            ("tier2-rust-cpu-all-20261010T100000Z.json", 2),
            ("tier2-rust-cpu-all-extra-20261011T100000Z.json", 3),
        ] {
            fs::write(dir.path().join(name), format!(r#"{{"stats": {{"p50": {p50}}}}}"#)).unwrap();
        }
        let results = Results::open(dir.path()).unwrap();
        let run = results.latest("tier2-rust-cpu-all").unwrap();
        assert_eq!(run.and_then(|run| run.stat("p50")), Some(2.));
    }
}
