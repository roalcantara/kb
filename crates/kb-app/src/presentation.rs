//! What the screens show for an entry: labels, icons, the primary action and the metadata, as
//! plain data. Kept apart from rendering so the Raycast behaviour it reproduces is tested directly.

use gpui_kit::assets::IconName;
use kb_domain::entry::Entry;

/// The notes pane's text when an entry has no notes.
pub const NO_NOTES: &str = "*No additional notes available for this entry.*";

/// Tags shown on a list row before the rest collapse into `+N`.
pub const MAX_ROW_TAGS: usize = 3;

/// An entry type, singular, as the actions and icons distinguish it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TypeKey {
    /// `bookmarks`
    Bookmark,
    /// `commands`
    Command,
    /// `cheats`
    Cheat,
    /// `notes`
    Note,
    /// `tasks`
    Task,
    /// Any other type.
    Other,
}

/// The type, trimmed, lowercased and singular: `Bookmarks` → `Bookmark`.
#[must_use]
pub fn type_key(entry_type: &str) -> TypeKey {
    let normalized = entry_type.trim().to_lowercase();
    match normalized.strip_suffix('s').unwrap_or(&normalized) {
        "bookmark" => TypeKey::Bookmark,
        "command" => TypeKey::Command,
        "cheat" => TypeKey::Cheat,
        "note" => TypeKey::Note,
        "task" => TypeKey::Task,
        _ => TypeKey::Other,
    }
}

/// The type as people read it: the known names, else the type with its first letter capitalized.
#[must_use]
pub fn type_label(entry_type: &str) -> String {
    let normalized = entry_type.trim().to_lowercase();
    let known = match normalized.as_str() {
        "bookmarks" => "Bookmarks",
        "bookmark" => "Bookmark",
        "commands" => "Commands",
        "command" => "Command",
        "cheats" => "Cheats",
        "cheat" => "Cheat",
        "notes" => "Notes",
        "note" => "Note",
        "tasks" => "Tasks",
        "task" => "Task",
        _ => {
            let mut chars = normalized.chars();
            return chars
                .next()
                .map_or_else(String::new, |first| first.to_uppercase().chain(chars).collect());
        }
    };
    known.to_owned()
}

/// A colour role from the theme's palette. Rendering resolves it against the active theme
/// (`cx.theme().red`, …), so badges and tags follow light, dark and custom themes alike.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Hue {
    /// `theme.red`
    Red,
    /// `theme.yellow`
    Yellow,
    /// `theme.green`
    Green,
    /// `theme.cyan`
    Cyan,
    /// `theme.blue`
    Blue,
    /// `theme.magenta`
    Magenta,
    /// The muted foreground: no hue.
    Neutral,
}

/// The coloured square that leads a list row: a glyph or an icon, in the type's hue.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TypeBadge {
    /// The icon, used when there is no glyph.
    pub icon: IconName,
    /// A text glyph shown instead of the icon: `>` for commands, as in a terminal.
    pub glyph: Option<&'static str>,
    /// The type's hue.
    pub hue: Hue,
}

/// The badge for an entry type.
#[must_use]
pub fn type_badge(entry_type: &str) -> TypeBadge {
    let (icon, glyph, hue) = match type_key(entry_type) {
        TypeKey::Command => (IconName::SquareTerminal, Some(">"), Hue::Green),
        TypeKey::Cheat => (IconName::FileText, None, Hue::Blue),
        TypeKey::Bookmark => (IconName::Globe, None, Hue::Cyan),
        TypeKey::Note => (IconName::BookOpen, None, Hue::Magenta),
        TypeKey::Task => (IconName::CircleCheck, None, Hue::Red),
        TypeKey::Other => (IconName::FileText, None, Hue::Neutral),
    };
    TypeBadge { icon, glyph, hue }
}

/// The hues tags are spread over, in hash order.
const TAG_HUES: [Hue; 6] = [Hue::Red, Hue::Yellow, Hue::Green, Hue::Cyan, Hue::Blue, Hue::Magenta];

/// A tag's hue: a stable hash of its lowercased name, so a tag keeps its colour everywhere.
#[must_use]
pub fn tag_hue(tag: &str) -> Hue {
    let hash = tag.to_lowercase().bytes().fold(5381_usize, |hash, byte| {
        hash.wrapping_mul(33).wrapping_add(usize::from(byte))
    });
    TAG_HUES[hash % TAG_HUES.len()]
}

/// What the primary action does.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrimaryKind {
    /// Open the content in the browser.
    OpenInBrowser,
    /// Copy the content.
    Copy,
}

/// An entry type's primary action, as data.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrimaryAction {
    /// What it does.
    pub kind: PrimaryKind,
    /// Its label.
    pub title: &'static str,
    /// What it opens or copies.
    pub content: String,
}

/// A bookmark opens; commands, cheats, notes and tasks copy.
#[must_use]
pub fn primary_action(entry: &Entry) -> PrimaryAction {
    let (kind, title) = match type_key(&entry.entry_type) {
        TypeKey::Bookmark => (PrimaryKind::OpenInBrowser, "Open in Browser"),
        TypeKey::Command => (PrimaryKind::Copy, "Copy Command Snippet"),
        TypeKey::Cheat => (PrimaryKind::Copy, "Copy Cheat Sheet"),
        TypeKey::Note => (PrimaryKind::Copy, "Copy Notes"),
        TypeKey::Task => (PrimaryKind::Copy, "Copy Task"),
        TypeKey::Other => (PrimaryKind::Copy, "Copy Primary Content"),
    };
    PrimaryAction {
        kind,
        title,
        content: entry.primary_content.clone(),
    }
}

/// The tags a row shows and how many more there are.
#[must_use]
pub fn row_tags(tags: &[String]) -> (&[String], usize) {
    let shown = tags.len().min(MAX_ROW_TAGS);
    (&tags[..shown], tags.len() - shown)
}

/// The Markdown the notes pane renders.
#[must_use]
pub fn notes_markdown(entry: &Entry) -> &str {
    if entry.notes_markdown.is_empty() {
        NO_NOTES
    } else {
        &entry.notes_markdown
    }
}

/// The metadata pane's rows, in the Raycast order: target, type, workflow, description, tags,
/// links, source.
#[must_use]
pub fn metadata(entry: &Entry) -> Vec<(&'static str, String)> {
    let mut rows = Vec::new();
    match type_key(&entry.entry_type) {
        TypeKey::Bookmark => rows.push(("URL", entry.primary_content.clone())),
        TypeKey::Command => rows.push(("Command", entry.primary_content.clone())),
        _ => {}
    }
    rows.push(("Type", type_label(&entry.entry_type)));
    if let Some(status) = &entry.task_status {
        rows.push(("Status", status.clone()));
    }
    if let Some(priority) = &entry.task_priority {
        rows.push(("Priority", priority.clone()));
    }
    if let Some(description) = &entry.description {
        rows.push(("Description", description.clone()));
    }
    if !entry.tags.is_empty() {
        rows.push((
            "Tags",
            entry.tags.iter().map(|t| format!("#{t}")).collect::<Vec<_>>().join(" "),
        ));
    }
    if !entry.links.is_empty() {
        let titles: Vec<&str> = entry
            .links
            .iter()
            .map(|l| l.title.as_deref().unwrap_or(&l.url))
            .collect();
        rows.push(("Links", titles.join(", ")));
    }
    rows.push(("Source", entry.source_rel_path.clone()));
    rows
}

#[cfg(test)]
mod tests {
    use kb_domain::entry::EntryLink;

    use super::*;
    use crate::fixture::entry;

    #[test]
    fn reads_types_singular_and_case_insensitively() {
        assert_eq!(type_key(" Bookmarks "), TypeKey::Bookmark);
        assert_eq!(type_key("task"), TypeKey::Task);
        assert_eq!(type_key("snippets"), TypeKey::Other);
        assert_eq!(type_label("commands"), "Commands");
        assert_eq!(type_label("snippets"), "Snippets");
        assert_eq!(type_label(""), "");
    }

    #[test]
    fn matches_the_raycast_primary_action_matrix() {
        let cases = [
            ("bookmarks", PrimaryKind::OpenInBrowser, "Open in Browser"),
            ("commands", PrimaryKind::Copy, "Copy Command Snippet"),
            ("cheats", PrimaryKind::Copy, "Copy Cheat Sheet"),
            ("notes", PrimaryKind::Copy, "Copy Notes"),
            ("tasks", PrimaryKind::Copy, "Copy Task"),
            ("snippets", PrimaryKind::Copy, "Copy Primary Content"),
        ];
        for (entry_type, kind, title) in cases {
            let action = primary_action(&entry(entry_type, "key", "title: t\n"));
            assert_eq!(
                (action.kind, action.title, action.content.as_str()),
                (kind, title, "key")
            );
        }
    }

    #[test]
    fn collapses_tags_after_three() {
        let tags: Vec<String> = ["a", "b", "c", "d", "e"].map(String::from).to_vec();
        assert_eq!(row_tags(&tags), (&tags[..3], 2));
        assert_eq!(row_tags(&tags[..2]), (&tags[..2], 0));
    }

    #[test]
    fn falls_back_to_a_placeholder_without_notes() {
        let mut bare = entry("notes", "k", "title: t\n");
        bare.notes_markdown.clear();
        assert_eq!(notes_markdown(&bare), NO_NOTES);
    }

    #[test]
    fn lists_metadata_in_raycast_order() {
        let mut task = entry(
            "tasks",
            "port",
            "desc: Port it\nstatus: todo\npriority: high\ntags: [rust, kb]\nlinks: [{Spec: https://s.example}]\n",
        );
        task.links.push(EntryLink {
            title: None,
            url: "https://u.example".into(),
        });
        let labels: Vec<&str> = metadata(&task).iter().map(|(label, _)| *label).collect();
        assert_eq!(
            labels,
            ["Type", "Status", "Priority", "Description", "Tags", "Links", "Source"]
        );
        assert_eq!(metadata(&task)[4].1, "#rust #kb");
        assert_eq!(metadata(&task)[5].1, "Spec, https://u.example");
        assert_eq!(
            metadata(&entry("bookmarks", "https://b.example", "title: B\n"))[0],
            ("URL", "https://b.example".into())
        );
    }

    #[test]
    fn gives_each_type_its_badge() {
        assert_eq!(
            type_badge("Commands"),
            TypeBadge {
                icon: IconName::SquareTerminal,
                glyph: Some(">"),
                hue: Hue::Green
            }
        );
        assert_eq!(
            (type_badge("cheats").icon, type_badge("cheats").hue),
            (IconName::FileText, Hue::Blue)
        );
        assert_eq!(type_badge("bookmarks").hue, Hue::Cyan);
        assert_eq!(type_badge("snippets").hue, Hue::Neutral);
    }

    #[test]
    fn hashes_tags_to_a_stable_hue_whatever_their_case() {
        assert_eq!(tag_hue("Git"), tag_hue("git"));
        let hues: std::collections::HashSet<Hue> = ["git", "aws", "kube", "rust", "ai", "docker", "nu", "react"]
            .map(tag_hue)
            .into_iter()
            .collect();
        assert!(hues.len() > 2, "tags spread over several hues");
        assert!(!hues.contains(&Hue::Neutral));
    }
}
