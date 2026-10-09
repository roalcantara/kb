//! The search text as an FTS5 query.

/// Replaces FTS5 control characters with spaces and collapses whitespace.
///
/// ```
/// assert_eq!(kb_domain::query::sanitize_query_text(r#" git  "rebase*" "#), "git rebase");
/// ```
#[must_use]
pub fn sanitize_query_text(input: &str) -> String {
    let spaced: String = input
        .chars()
        .map(|c| {
            if matches!(c, '"' | '\'' | '*' | '^' | ':' | '(' | ')' | '{' | '}' | '[' | ']') {
                ' '
            } else {
                c
            }
        })
        .collect();
    spaced.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The search words.
///
/// ```
/// assert_eq!(kb_domain::query::tokenize_query("docker (ps)"), ["docker", "ps"]);
/// ```
#[must_use]
pub fn tokenize_query(text: &str) -> Vec<String> {
    sanitize_query_text(text)
        .split(' ')
        .filter(|t| !t.is_empty())
        .map(str::to_owned)
        .collect()
}

/// Each word as a quoted prefix term: `docker run` → `"docker"* "run"*`; empty when no words.
#[must_use]
pub fn fts_prefix_query(text: &str) -> String {
    tokenize_query(text)
        .iter()
        .map(|t| format!("\"{t}\"*"))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_control_characters_and_collapses_whitespace() {
        assert_eq!(sanitize_query_text("  a\"b'c*d^e:f (g) {h} [i]  "), "a b c d e f g h i");
    }

    #[test]
    fn builds_prefix_terms() {
        assert_eq!(fts_prefix_query("docker run"), "\"docker\"* \"run\"*");
        assert_eq!(fts_prefix_query(" :* "), "");
    }
}
