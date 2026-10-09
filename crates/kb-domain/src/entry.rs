//! The entry: one knowledge node, normalized from its YAML.

use saphyr::YamlOwned;
use serde::{Deserialize, Serialize};

use crate::yaml::{self, as_str, field, is_null};

/// A link attached to an entry: a bare URL, or a titled one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EntryLink {
    /// The title, when the source gave one (`- Guide: https://…`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// The URL.
    pub url: String,
}

/// One knowledge node users can search and open.
#[derive(Debug, Clone, PartialEq)]
pub struct Entry {
    /// `<rel path>#<type>#<key>`.
    pub id: String,
    /// An explicit `title:`, else the key.
    pub title: String,
    /// `desc:` or `description:`.
    pub description: Option<String>,
    /// The top-level YAML key the entry sits under.
    pub entry_type: String,
    /// Lowercased `tags:` (or `tag:`).
    pub tags: Vec<String>,
    /// The notes as the source wrote them.
    pub notes: Option<YamlOwned>,
    /// The notes compiled to Markdown; empty until a sync compiles them.
    pub notes_markdown: String,
    /// Attached links.
    pub links: Vec<EntryLink>,
    /// The absolute path of the source file.
    pub source_file: String,
    /// The source file's path relative to the sources directory.
    pub source_rel_path: String,
    /// What the main action opens or copies.
    pub primary_content: String,
    /// Task entries only: `status:`.
    pub task_status: Option<String>,
    /// Task entries only: `priority:`.
    pub task_priority: Option<String>,
    /// The entry's map written back as YAML.
    pub raw_yaml: String,
}

/// `<rel path>#<type>#<key>`, the path with forward slashes and no leading slash. Case is kept:
/// the id is the index's primary key.
///
/// ```
/// let id = kb_domain::entry::derive_entry_id("/tools/cli.yml", "commands", "ls -la");
/// assert_eq!(id, "tools/cli.yml#commands#ls -la");
/// ```
#[must_use]
pub fn derive_entry_id(source_rel_path: &str, entry_type: &str, key: &str) -> String {
    let path = source_rel_path.replace('\\', "/");
    format!("{}#{entry_type}#{key}", path.trim_start_matches('/'))
}

/// A trimmed, non-empty string field; `None` when absent, blank or not a string.
#[must_use]
pub fn raw_string(raw: &YamlOwned, name: &str) -> Option<String> {
    field(raw, name)
        .and_then(as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

/// The explicit `url`, `cmd`, `cheat` or `task` field, else the key: bookmarks and commands put
/// their payload in the key.
#[must_use]
pub fn primary_content(raw: &YamlOwned, key: &str) -> String {
    ["url", "cmd", "cheat", "task"]
        .iter()
        .find_map(|name| raw_string(raw, name))
        .unwrap_or_else(|| key.trim().to_owned())
}

/// Links from a list of URLs or `title: url` maps; anything else is dropped.
#[must_use]
pub fn normalize_links(links: Option<&YamlOwned>) -> Vec<EntryLink> {
    let Some(YamlOwned::Sequence(items)) = links else {
        return Vec::new();
    };
    items
        .iter()
        .flat_map(|item| match item {
            YamlOwned::Mapping(pairs) => pairs
                .iter()
                .filter_map(|(title, url)| {
                    let url = as_str(url)?.trim();
                    (!url.is_empty()).then(|| EntryLink {
                        title: Some(yaml::scalar_text(title).unwrap_or_default().trim().to_owned()),
                        url: url.to_owned(),
                    })
                })
                .collect::<Vec<_>>(),
            _ => as_str(item)
                .map(str::trim)
                .filter(|url| !url.is_empty())
                .map(|url| EntryLink {
                    title: None,
                    url: url.to_owned(),
                })
                .into_iter()
                .collect(),
        })
        .collect()
}

/// Tags from a list or a single string, trimmed, lowercased, blanks dropped.
#[must_use]
pub fn normalize_tags(tags: Option<&YamlOwned>) -> Vec<String> {
    let tidy = |tag: String| Some(tag.trim().to_lowercase()).filter(|t| !t.is_empty());
    match tags {
        Some(YamlOwned::Sequence(items)) => items.iter().filter_map(yaml::scalar_text).filter_map(tidy).collect(),
        Some(node) => as_str(node).map(str::to_owned).and_then(tidy).into_iter().collect(),
        None => Vec::new(),
    }
}

/// A field, unless it is null: JavaScript's `raw.a ?? raw.b`.
fn present<'a>(raw: &'a YamlOwned, name: &str) -> Option<&'a YamlOwned> {
    field(raw, name).filter(|node| !is_null(node))
}

/// Normalizes one entry from its source map.
#[must_use]
pub fn normalize_entry(
    source_file: &str,
    source_rel_path: &str,
    entry_type: &str,
    key: &str,
    raw: &YamlOwned,
) -> Entry {
    let is_task = entry_type.to_lowercase().contains("task");
    Entry {
        id: derive_entry_id(source_rel_path, entry_type, key),
        title: raw_string(raw, "title").unwrap_or_else(|| key.trim().to_owned()),
        description: raw_string(raw, "desc").or_else(|| raw_string(raw, "description")),
        entry_type: entry_type.to_owned(),
        tags: normalize_tags(present(raw, "tags").or_else(|| present(raw, "tag"))),
        notes: present(raw, "notes").cloned(),
        notes_markdown: String::new(),
        links: normalize_links(field(raw, "links")),
        source_file: source_file.to_owned(),
        source_rel_path: source_rel_path.to_owned(),
        primary_content: primary_content(raw, key),
        task_status: if is_task { raw_string(raw, "status") } else { None },
        task_priority: if is_task { raw_string(raw, "priority") } else { None },
        raw_yaml: yaml::emit(raw),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(source: &str) -> YamlOwned {
        yaml::load(source).unwrap().unwrap()
    }

    #[test]
    fn derives_ids_with_forward_slashes_and_no_leading_slash() {
        assert_eq!(
            derive_entry_id("/misc\\snippets.yaml", "snippets", "Hello"),
            "misc/snippets.yaml#snippets#Hello"
        );
    }

    #[test]
    fn prefers_explicit_fields_for_primary_content() {
        assert_eq!(primary_content(&raw("cmd: ' ls -la '\n"), "key"), "ls -la");
        assert_eq!(primary_content(&raw("title: t\n"), " key "), "key");
    }

    #[test]
    fn normalizes_links_from_urls_and_titled_maps() {
        let links = normalize_links(Some(&raw(
            "[https://a.example, {Guide: https://b.example, API: ' '}, 3]",
        )));
        assert_eq!(
            links,
            [
                EntryLink {
                    title: None,
                    url: "https://a.example".into()
                },
                EntryLink {
                    title: Some("Guide".into()),
                    url: "https://b.example".into()
                },
            ]
        );
    }

    #[test]
    fn normalizes_tags_from_a_list_or_a_string() {
        assert_eq!(normalize_tags(Some(&raw("[Git, ' Talks ', '']"))), ["git", "talks"]);
        assert_eq!(normalize_tags(Some(&raw("Mixed-Case"))), ["mixed-case"]);
        assert_eq!(normalize_tags(None), Vec::<String>::new());
    }

    #[test]
    fn reads_task_columns_only_for_tasks() {
        let source = raw("status: done\npriority: high\n");
        assert_eq!(
            normalize_entry("/f", "f", "tasks", "k", &source).task_status.as_deref(),
            Some("done")
        );
        assert_eq!(normalize_entry("/f", "f", "bookmarks", "k", &source).task_status, None);
    }
}
