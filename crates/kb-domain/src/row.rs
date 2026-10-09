//! The index row: an entry's SQLite projection, and the way back.

use saphyr::YamlOwned;
use serde::{Deserialize, Serialize};

use crate::entry::{Entry, EntryLink, normalize_tags, raw_string};
use crate::yaml::{self, as_str, field, is_null};

/// One row of the `entries` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IndexRow {
    /// The entry id.
    pub id: String,
    /// The display title.
    pub title: String,
    /// The description, or empty.
    pub description: String,
    /// The entry type.
    #[serde(rename = "type")]
    pub entry_type: String,
    /// The notes' plain text, for the full-text index.
    pub notes: String,
    /// The notes compiled to Markdown.
    pub notes_markdown: String,
    /// What the main action opens or copies.
    pub primary_content: String,
    /// The links as JSON.
    pub links_json: String,
    /// The absolute source path.
    pub source_file: String,
    /// The source path relative to the sources directory.
    pub source_rel_path: String,
    /// The entry's map as YAML.
    pub raw_yaml: String,
}

fn item_strings(item: &YamlOwned) -> Vec<String> {
    match item {
        YamlOwned::Mapping(pairs) => pairs
            .iter()
            .filter_map(|(_, v)| as_str(v))
            .map(|s| s.trim().to_owned())
            .collect(),
        _ => as_str(item).map(|s| vec![s.trim().to_owned()]).unwrap_or_default(),
    }
}

/// The notes' text without Markdown, so the full-text index scores words, not syntax.
#[must_use]
pub fn searchable_notes_text(notes: Option<&YamlOwned>) -> String {
    match notes {
        None => String::new(),
        Some(YamlOwned::Sequence(items)) => items.iter().flat_map(item_strings).collect::<Vec<_>>().join(" "),
        Some(node) => item_strings(node).join(" "),
    }
}

/// Projects an entry into its row.
#[must_use]
pub fn entry_to_row(entry: &Entry) -> IndexRow {
    IndexRow {
        id: entry.id.clone(),
        title: entry.title.clone(),
        description: entry.description.clone().unwrap_or_default(),
        entry_type: entry.entry_type.clone(),
        notes: searchable_notes_text(entry.notes.as_ref()),
        notes_markdown: entry.notes_markdown.clone(),
        primary_content: entry.primary_content.clone(),
        // Serializing owned strings cannot fail.
        links_json: serde_json::to_string(&entry.links).unwrap_or_else(|_| "[]".into()),
        source_file: entry.source_file.clone(),
        source_rel_path: entry.source_rel_path.clone(),
        raw_yaml: entry.raw_yaml.clone(),
    }
}

/// Rebuilds the entry a row was projected from. Tags and task columns are re-read from
/// `raw_yaml` with the writer's own rules, so a row renders as its entry did.
#[must_use]
pub fn row_to_entry(row: &IndexRow) -> Entry {
    let raw = yaml::load(&row.raw_yaml).ok().flatten().unwrap_or(YamlOwned::BadValue);
    let tags = field(&raw, "tags")
        .filter(|n| !is_null(n))
        .or_else(|| field(&raw, "tag").filter(|n| !is_null(n)));
    let is_task = row.entry_type.to_lowercase().contains("task");
    Entry {
        id: row.id.clone(),
        title: row.title.clone(),
        description: Some(row.description.clone()).filter(|d| !d.is_empty()),
        entry_type: row.entry_type.clone(),
        tags: normalize_tags(tags),
        notes: (!row.notes.is_empty()).then(|| YamlOwned::Value(saphyr::ScalarOwned::String(row.notes.clone()))),
        notes_markdown: if row.notes_markdown.is_empty() {
            row.notes.clone()
        } else {
            row.notes_markdown.clone()
        },
        links: serde_json::from_str::<Vec<EntryLink>>(&row.links_json).unwrap_or_default(),
        source_file: row.source_file.clone(),
        source_rel_path: row.source_rel_path.clone(),
        primary_content: row.primary_content.clone(),
        task_status: if is_task { raw_string(&raw, "status") } else { None },
        task_priority: if is_task { raw_string(&raw, "priority") } else { None },
        raw_yaml: row.raw_yaml.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entry::normalize_entry;

    fn entry(entry_type: &str, source: &str) -> Entry {
        let raw = yaml::load(source).unwrap().unwrap();
        normalize_entry("/root/f.yml", "f.yml", entry_type, "k", &raw)
    }

    #[test]
    fn indexes_the_plain_text_of_every_notes_shape() {
        let notes = |source| searchable_notes_text(entry("notes", source).notes.as_ref());
        assert_eq!(notes("notes: ' plain '\n"), "plain");
        assert_eq!(notes("notes: [' one ', {md: ' two '}, 3]\n"), "one two");
        assert_eq!(notes("notes: {md: a, sh: b}\n"), "a b");
        assert_eq!(notes("title: none\n"), "");
    }

    #[test]
    fn writes_links_as_the_typescript_engine_does() {
        let row = entry_to_row(&entry(
            "bookmarks",
            "links: [https://a.example, {Guide: https://b.example}]\n",
        ));
        assert_eq!(
            row.links_json,
            r#"[{"url":"https://a.example"},{"title":"Guide","url":"https://b.example"}]"#
        );
    }

    #[test]
    fn rebuilds_tags_and_task_columns_from_the_row() {
        let original = entry("tasks", "tags: [Rust]\nstatus: todo\npriority: high\nnotes: text\n");
        let rebuilt = row_to_entry(&entry_to_row(&original));
        assert_eq!(rebuilt.tags, ["rust"]);
        assert_eq!(rebuilt.task_status.as_deref(), Some("todo"));
        assert_eq!(rebuilt.task_priority.as_deref(), Some("high"));
        assert_eq!(rebuilt.links, original.links);
    }
}
