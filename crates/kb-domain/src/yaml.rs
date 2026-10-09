//! The YAML the engine reads and writes, through `saphyr`.
//!
//! The sources follow one schema (see the design spec, "Source schema"), so the engine reads
//! them with `saphyr`'s loader as it is: no JavaScript-compatibility layer.

use saphyr::{LoadableYamlNode, ScalarOwned, Yaml, YamlEmitter, YamlOwned};

/// Why a source did not parse, and where: 1-based line and column.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{message}")]
pub struct YamlError {
    /// The parser's own description.
    pub message: String,
    /// 1-based line.
    pub line: usize,
    /// 1-based column.
    pub column: usize,
}

/// Parses the first document of `source`; an empty source is `None`.
///
/// # Errors
///
/// The scanner's error, with its position.
pub fn load(source: &str) -> Result<Option<YamlOwned>, YamlError> {
    YamlOwned::load_from_str(source)
        .map(|documents| documents.into_iter().next())
        .map_err(|error| YamlError {
            message: error.info().to_owned(),
            line: error.marker().line(),
            // saphyr's marker column is 0-based.
            column: error.marker().col() + 1,
        })
}

/// The text of a scalar: strings as they are, other scalars in their YAML spelling.
#[must_use]
pub fn scalar_text(node: &YamlOwned) -> Option<String> {
    match node {
        YamlOwned::Value(ScalarOwned::String(s)) => Some(s.clone()),
        YamlOwned::Value(ScalarOwned::Integer(i)) => Some(i.to_string()),
        YamlOwned::Value(ScalarOwned::FloatingPoint(f)) => Some(f.to_string()),
        YamlOwned::Value(ScalarOwned::Boolean(b)) => Some(b.to_string()),
        YamlOwned::Value(ScalarOwned::Null) => Some("null".to_owned()),
        _ => None,
    }
}

/// The string a node holds, if it is a string.
#[must_use]
pub fn as_str(node: &YamlOwned) -> Option<&str> {
    match node {
        YamlOwned::Value(ScalarOwned::String(s)) => Some(s),
        _ => None,
    }
}

/// A field of a mapping, by name.
#[must_use]
pub fn field<'a>(map: &'a YamlOwned, name: &str) -> Option<&'a YamlOwned> {
    match map {
        YamlOwned::Mapping(entries) => entries.iter().find(|(k, _)| as_str(k) == Some(name)).map(|(_, v)| v),
        _ => None,
    }
}

/// Whether a node is null or absent in the sense of JavaScript's `??`.
#[must_use]
pub fn is_null(node: &YamlOwned) -> bool {
    matches!(node, YamlOwned::Value(ScalarOwned::Null) | YamlOwned::BadValue)
}

/// The node as JSON: notes blocks whose content is not text are shown as JSON.
#[must_use]
pub fn to_json(node: &YamlOwned) -> serde_json::Value {
    use serde_json::Value as Json;
    match node {
        YamlOwned::Value(ScalarOwned::String(s)) => Json::String(s.clone()),
        YamlOwned::Value(ScalarOwned::Integer(i)) => Json::from(*i),
        YamlOwned::Value(ScalarOwned::FloatingPoint(f)) => Json::from(f.into_inner()),
        YamlOwned::Value(ScalarOwned::Boolean(b)) => Json::Bool(*b),
        YamlOwned::Sequence(items) => Json::Array(items.iter().map(to_json).collect()),
        YamlOwned::Mapping(entries) => Json::Object(
            entries
                .iter()
                .map(|(k, v)| (scalar_text(k).unwrap_or_default(), to_json(v)))
                .collect(),
        ),
        YamlOwned::Tagged(_, inner) => to_json(inner),
        _ => Json::Null,
    }
}

/// The node written back as YAML, for `raw_yaml`.
#[must_use]
pub fn emit(node: &YamlOwned) -> String {
    let mut out = String::new();
    // Writing to a String cannot fail; an emitter error leaves what was written so far.
    let _ = YamlEmitter::new(&mut out).dump(&Yaml::from(node));
    out.push('\n');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_an_empty_source_as_no_document() {
        assert_eq!(load(""), Ok(None));
        assert_eq!(load("# a comment\n"), Ok(None));
    }

    #[test]
    fn reports_where_a_source_breaks() {
        let error = load("a: 1\nb: [2\n").unwrap_err();
        assert_eq!((error.line, error.column), (3, 1));
    }

    #[test]
    fn reads_fields_and_strings() {
        let doc = load("title: kb\ncount: 2\n").unwrap().unwrap();
        assert_eq!(field(&doc, "title").and_then(as_str), Some("kb"));
        assert_eq!(field(&doc, "count").and_then(as_str), None);
        assert_eq!(field(&doc, "count").and_then(scalar_text).as_deref(), Some("2"));
    }

    #[test]
    fn writes_yaml_that_reads_back_as_the_same_value() {
        let doc = load("a: [1, two]\nb:\n  c: |\n    multi\n    line\n").unwrap().unwrap();
        assert_eq!(load(&emit(&doc)).unwrap(), Some(doc));
    }
}
