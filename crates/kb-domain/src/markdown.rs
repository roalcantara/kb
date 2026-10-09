//! An entry's notes, description, links and provenance as Markdown.
//!
//! The output matches the TypeScript engine byte for byte. That engine builds a list of blocks
//! and renders them with `json2md`; this module keeps the same blocks and renders the subset of
//! `json2md` they use. No crate implements `json2md`, and the subset is small.

use base64::Engine as _;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use saphyr::YamlOwned;

use crate::entry::Entry;
use crate::yaml::{as_str, to_json};

/// One `json2md` block.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Block {
    /// Inserted as it is.
    Text(String),
    /// `![](source "title")`
    Image { title: &'static str, source: String },
    /// A fenced code block.
    Code { language: String, content: String },
    /// Every line prefixed with `> `.
    Blockquote(String),
    /// `### text`
    H3(&'static str),
    /// ` - item` per item.
    List(Vec<String>),
}

/// Aliases the TS engine maps to a canonical fence language; any other language is kept.
fn code_language(language: &str) -> &str {
    match language {
        "sh" | "shell" | "bash" | "zsh" => "bash",
        "ts" | "typescript" => "typescript",
        "js" | "javascript" => "javascript",
        "yaml" | "yml" | "dockercompose" => "yaml",
        "json" | "jsonc" => "json",
        "py" | "python" => "python",
        other => other,
    }
}

/// The `YouTube` video id of a watch, embed or share URL.
#[must_use]
pub fn youtube_video_id(url: &str) -> Option<&str> {
    let start = ["youtube.com/watch?v=", "youtube.com/embed/", "youtu.be/"]
        .iter()
        .find_map(|marker| url.find(marker).map(|at| at + marker.len()))?;
    let rest = &url[start..];
    let end = rest
        .find(|c: char| matches!(c, '&' | '?' | '/') || c.is_whitespace())
        .unwrap_or(rest.len());
    (end > 0).then(|| &rest[..end])
}

/// One `format: content` notes block.
fn format_block(format: &str, content: &YamlOwned) -> Block {
    let format = format.trim().to_lowercase();
    let text = as_str(content).map_or_else(
        || serde_json::to_string_pretty(&to_json(content)).unwrap_or_default(),
        str::to_owned,
    );
    match format.as_str() {
        "md" | "markdown" => Block::Text(text),
        "mermaid" => Block::Image {
            title: "Mermaid Diagram",
            source: format!(
                "https://mermaid.ink/img/{}?type=png&bgColor=fff",
                URL_SAFE_NO_PAD.encode(&text)
            ),
        },
        "svg" => Block::Image {
            title: "SVG Image",
            source: format!("data:image/svg+xml;base64,{}", STANDARD.encode(&text)),
        },
        "img" => Block::Image {
            title: "Image",
            source: text,
        },
        language => Block::Code {
            language: code_language(language).to_owned(),
            content: text,
        },
    }
}

fn map_blocks(node: &YamlOwned) -> Vec<Block> {
    match node {
        YamlOwned::Mapping(pairs) => pairs
            .iter()
            .map(|(k, v)| format_block(&crate::yaml::scalar_text(k).unwrap_or_default(), v))
            .collect(),
        _ => Vec::new(),
    }
}

/// The notes as blocks: a string, a list of strings and `format: content` maps, or one map.
fn notes_blocks(notes: &YamlOwned) -> Vec<Block> {
    match notes {
        YamlOwned::Sequence(items) => items
            .iter()
            .flat_map(|item| match as_str(item) {
                Some(text) => vec![Block::Text(text.to_owned())],
                None => map_blocks(item),
            })
            .collect(),
        YamlOwned::Mapping(_) => map_blocks(notes),
        _ => as_str(notes)
            .map(|text| vec![Block::Text(text.to_owned())])
            .unwrap_or_default(),
    }
}

/// Whether JavaScript would treat the notes as truthy (`if (entry.notes)`).
fn has_notes(notes: Option<&YamlOwned>) -> bool {
    notes.is_some_and(|n| as_str(n).is_none_or(|s| !s.is_empty()))
}

/// Compiles an entry's notes, description, links and source into Markdown.
#[must_use]
pub fn build_entry_markdown(entry: &Entry) -> String {
    let entry_type = entry.entry_type.to_lowercase();
    let mut blocks = Vec::new();

    if entry_type.contains("bookmark")
        && let Some(id) = youtube_video_id(&entry.primary_content)
    {
        blocks.push(Block::Image {
            title: "YouTube Thumbnail",
            source: format!("https://img.youtube.com/vi/{id}/maxresdefault.jpg"),
        });
    }
    if entry_type.contains("command") {
        blocks.push(Block::Code {
            language: "bash".into(),
            content: entry.primary_content.clone(),
        });
    }
    if let Some(description) = entry.description.as_deref().map(str::trim).filter(|d| !d.is_empty()) {
        blocks.push(Block::Blockquote(description.to_owned()));
    }
    if has_notes(entry.notes.as_ref()) {
        blocks.extend(entry.notes.as_ref().map(notes_blocks).unwrap_or_default());
    }
    if !entry.links.is_empty() {
        blocks.push(Block::H3("LINKS"));
        blocks.push(Block::List(
            entry
                .links
                .iter()
                .map(|l| {
                    format!(
                        "[{}]({})",
                        l.title.as_deref().filter(|t| !t.is_empty()).unwrap_or(&l.url),
                        l.url
                    )
                })
                .collect(),
        ));
    }
    blocks.push(Block::Text(format!("\n\n*Source: `{}`*", entry.source_rel_path)));

    blocks.iter().map(render).collect::<Vec<_>>().join("\n")
}

/// `json2md` of one block. Every typed block ends with a newline; a text block does not.
fn render(block: &Block) -> String {
    match block {
        Block::Text(text) => text.clone(),
        Block::Image { title, source } => format!("![]({source} \"{title}\")\n"),
        Block::Code { language, content } => format!("```{language}\n{content}\n```\n"),
        Block::Blockquote(text) => format!("{}\n", prefix_lines(text, "> ")),
        Block::H3(text) => format!("### {text}\n"),
        Block::List(items) => {
            let mut body = String::new();
            for item in items {
                body.push_str("\n - ");
                body.push_str(&text_format(&indent_rest(item, 4)));
            }
            body.push('\n');
            body
        }
    }
}

/// `indento(text, 1, prefix)`: `text.replace(/^/gm, prefix)`, a prefix at the start and after
/// every JavaScript line terminator.
fn prefix_lines(text: &str, prefix: &str) -> String {
    let mut out = String::from(prefix);
    for c in text.chars() {
        out.push(c);
        if matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}') {
            out.push_str(prefix);
        }
    }
    out
}

/// `json2md`'s `indent(content, spaces, true)`: every line but the first indented.
fn indent_rest(text: &str, spaces: usize) -> String {
    let pad = " ".repeat(spaces);
    let mut lines = text.split('\n');
    let first = lines.next().unwrap_or_default().to_owned();
    lines.fold(first, |acc, line| format!("{acc}\n{pad}{line}"))
}

/// `json2md`'s `parseTextFormat`: HTML emphasis tags as Markdown markers.
fn text_format(text: &str) -> String {
    let mut out = text.to_owned();
    for (tag, marker) in [
        ("strong", "**"),
        ("bold", "**"),
        ("em", "*"),
        ("italic", "*"),
        ("u", "_"),
        ("strike", "~~"),
    ] {
        out = replace_tag(&out, tag, marker);
    }
    out
}

/// Replaces `<tag>` and `</tag>`, in any case, with `marker`.
fn replace_tag(text: &str, tag: &str, marker: &str) -> String {
    let lower = text.to_ascii_lowercase();
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < text.len() {
        let rest = &lower[i..];
        let close = rest.starts_with("</");
        let name_at = if close { 2 } else { 1 };
        if rest.starts_with('<') && rest[name_at..].starts_with(tag) && rest[name_at + tag.len()..].starts_with('>') {
            out.push_str(marker);
            i += name_at + tag.len() + 1;
        } else {
            let c = text[i..].chars().next().unwrap_or_default();
            out.push(c);
            i += c.len_utf8();
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_youtube_ids() {
        assert_eq!(
            youtube_video_id("https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=1"),
            Some("aqz-KE-bpKQ")
        );
        assert_eq!(youtube_video_id("https://youtu.be/wNw9fKErhdg"), Some("wNw9fKErhdg"));
        assert_eq!(youtube_video_id("https://example.com"), None);
    }

    #[test]
    fn prefixes_after_every_javascript_line_terminator() {
        assert_eq!(prefix_lines("a\nb\r\nc", "> "), "> a\n> b\r> \n> c");
    }

    #[test]
    fn rewrites_emphasis_tags_in_list_items() {
        assert_eq!(text_format("<STRONG>a</strong> <em>b</em>"), "**a** *b*");
    }

    #[test]
    fn indents_every_line_but_the_first() {
        assert_eq!(indent_rest("a\nb\nc", 4), "a\n    b\n    c");
    }
}
