//! Entries built from YAML for unit tests.

use kb_domain::entry::{Entry, normalize_entry};
use kb_domain::markdown::build_entry_markdown;
use kb_domain::yaml;

/// The entry `key` of `entry_type` whose map is `source`, with its notes compiled, as a sync
/// would index it from `/root/f.yml`.
pub fn entry(entry_type: &str, key: &str, source: &str) -> Entry {
    let raw = yaml::load(source).unwrap().unwrap();
    let mut entry = normalize_entry("/root/f.yml", "f.yml", entry_type, key, &raw);
    entry.notes_markdown = build_entry_markdown(&entry);
    entry
}
