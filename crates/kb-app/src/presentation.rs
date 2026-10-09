//! What the screens show for an entry: labels, icons, the primary action and the metadata, as
//! plain data. Kept apart from rendering so the Raycast behaviour it reproduces is tested directly.

use gpui_kit::Rgba;
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

/// The row icon for a type.
#[must_use]
pub fn type_icon(entry_type: &str) -> IconName {
    match type_key(entry_type) {
        TypeKey::Bookmark => IconName::Globe,
        TypeKey::Command => IconName::SquareTerminal,
        TypeKey::Note => IconName::BookOpen,
        TypeKey::Task => IconName::CircleCheck,
        TypeKey::Cheat | TypeKey::Other => IconName::FileText,
    }
}

/// The visual presentation of an entry type badge.
#[derive(Debug, Clone, PartialEq)]
pub struct TypeBadge {
    pub icon: IconName,
    pub glyph: Option<&'static str>,
    pub bg: Rgba,
    pub border: Rgba,
    pub fg: Rgba,
}

impl TypeBadge {
    #[must_use]
    pub fn is_terminal_style(&self) -> bool {
        self.glyph == Some(">")
    }
}

/// Returns the vibrant badge styling for an entry type.
#[must_use]
#[allow(clippy::unreadable_literal)]
pub fn type_badge(entry_type: &str) -> TypeBadge {
    match type_key(entry_type) {
        TypeKey::Command => TypeBadge {
            icon: IconName::ChevronRight,
            glyph: Some(">"),
            bg: gpui_kit::rgb(0x14532d),
            border: gpui_kit::rgb(0x22c55e),
            fg: gpui_kit::rgb(0x4ade80),
        },
        TypeKey::Cheat => TypeBadge {
            icon: IconName::FileText,
            glyph: None,
            bg: gpui_kit::rgb(0x1e3a8a),
            border: gpui_kit::rgb(0x3b82f6),
            fg: gpui_kit::rgb(0x93c5fd),
        },
        TypeKey::Bookmark => TypeBadge {
            icon: IconName::Globe,
            glyph: None,
            bg: gpui_kit::rgb(0x0c4a6e),
            border: gpui_kit::rgb(0x0284c7),
            fg: gpui_kit::rgb(0x38bdf8),
        },
        TypeKey::Note => TypeBadge {
            icon: IconName::BookOpen,
            glyph: None,
            bg: gpui_kit::rgb(0x3b0764),
            border: gpui_kit::rgb(0x9333ea),
            fg: gpui_kit::rgb(0xc084fc),
        },
        TypeKey::Task => TypeBadge {
            icon: IconName::CircleCheck,
            glyph: None,
            bg: gpui_kit::rgb(0x4c0519),
            border: gpui_kit::rgb(0xe11d48),
            fg: gpui_kit::rgb(0xfb7185),
        },
        TypeKey::Other => TypeBadge {
            icon: IconName::File,
            glyph: None,
            bg: gpui_kit::rgb(0x1e293b),
            border: gpui_kit::rgb(0x475569),
            fg: gpui_kit::rgb(0x94a3b8),
        },
    }
}

/// A pastel tint for a tag badge.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TagTint {
    pub bg: Rgba,
    pub fg: Rgba,
}

/// Curated palette of 6 pastel tag colors for dark mode.
#[allow(clippy::unreadable_literal)]
const TAG_PALETTE: [(u32, u32); 6] = [
    (0x3b181a, 0xf87171), // Coral
    (0x3d270c, 0xfbbf24), // Amber
    (0x13301f, 0x4ade80), // Emerald
    (0x132742, 0x60a5fa), // Sky
    (0x3b162c, 0xf472b6), // Rose
    (0x2f1b40, 0xc084fc), // Violet
];

/// Deterministically maps a tag name to a dark-mode pastel tint.
#[must_use]
pub fn tag_tint(tag: &str) -> TagTint {
    let mut hash: usize = 5381;
    for byte in tag.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as usize);
    }
    let (bg_hex, fg_hex) = TAG_PALETTE[hash % TAG_PALETTE.len()];
    TagTint {
        bg: gpui_kit::rgb(bg_hex),
        fg: gpui_kit::rgb(fg_hex),
    }
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
    fn matches_type_badge_colors_and_icons() {
        let cmd = type_badge("Command");
        assert_eq!(cmd.icon, IconName::ChevronRight);
        assert!(cmd.is_terminal_style());

        let cheat = type_badge("Cheat");
        assert_eq!(cheat.icon, IconName::FileText);

        let bookmark = type_badge("Bookmark");
        assert_eq!(bookmark.icon, IconName::Globe);
    }

    #[test]
    fn hashes_tags_deterministically_into_palette() {
        let tag1 = tag_tint("nu");
        let tag2 = tag_tint("nu");
        assert_eq!(tag1, tag2);

        let tag_schedule = tag_tint("schedule");
        assert_ne!(tag1, tag_schedule);
    }
}
