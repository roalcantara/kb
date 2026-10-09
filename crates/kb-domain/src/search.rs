//! Searching the index: one page of entries for a query and a filter.

use rusqlite::{Connection, params_from_iter};

use crate::query::fts_prefix_query;
use crate::row::IndexRow;

/// Entries per page, as the Raycast list shows them.
pub const PAGE_SIZE: usize = 50;

/// The entry types and tags a query is narrowed to: any selected type, every selected tag.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct FilterState {
    /// Selected entry types.
    pub types: Vec<String>,
    /// Selected tags.
    pub tags: Vec<String>,
}

/// The search text, filter and page window.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchQuery {
    /// What the user typed.
    pub text: String,
    /// The filter, if any.
    pub filter: FilterState,
    /// Page size.
    pub limit: usize,
    /// Rows to skip.
    pub offset: usize,
}

/// A statement and its parameters.
#[derive(Debug, Clone, PartialEq)]
pub struct SearchSql {
    /// The SQL.
    pub sql: String,
    /// Its parameters, in order.
    pub params: Vec<rusqlite::types::Value>,
}

/// The statement the TypeScript engine runs: FTS rank order with text, title order without.
/// `CROSS JOIN` pins the FTS match as the outer loop on every SQLite version.
#[must_use]
pub fn build_search_sql(query: &SearchQuery) -> SearchSql {
    use rusqlite::types::Value;
    let fts = fts_prefix_query(&query.text);
    let mut conditions = Vec::new();
    let mut params: Vec<Value> = Vec::new();
    if !fts.is_empty() {
        params.push(Value::Text(fts.clone()));
    }
    if !query.filter.types.is_empty() {
        conditions.push(format!(
            "e.type IN ({})",
            vec!["?"; query.filter.types.len()].join(", ")
        ));
        params.extend(query.filter.types.iter().cloned().map(Value::Text));
    }
    for tag in &query.filter.tags {
        conditions.push("EXISTS (SELECT 1 FROM entry_tags WHERE entry_id = e.id AND tag = ?)".to_owned());
        params.push(Value::Text(tag.clone()));
    }
    let limit = i64::try_from(query.limit).unwrap_or(i64::MAX);
    let offset = i64::try_from(query.offset).unwrap_or(i64::MAX);
    params.extend([Value::Integer(limit), Value::Integer(offset)]);
    let filter = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };
    let sql = if fts.is_empty() {
        format!("SELECT e.* FROM entries e{filter} ORDER BY e.title ASC LIMIT ? OFFSET ?")
    } else {
        format!(
            "SELECT e.* FROM entries_fts(?) fts CROSS JOIN entries e ON e.rowid = fts.rowid{filter} ORDER BY fts.rank LIMIT ? OFFSET ?"
        )
    };
    SearchSql { sql, params }
}

/// One page of rows for a query.
///
/// # Errors
///
/// An SQLite error.
pub fn search(connection: &Connection, query: &SearchQuery) -> rusqlite::Result<Vec<IndexRow>> {
    let SearchSql { sql, params } = build_search_sql(query);
    let mut statement = connection.prepare_cached(&sql)?;
    let rows = statement.query_map(params_from_iter(params), |row| {
        Ok(IndexRow {
            id: row.get("id")?,
            title: row.get("title")?,
            description: row.get("description")?,
            entry_type: row.get("type")?,
            notes: row.get("notes")?,
            notes_markdown: row.get("notes_markdown")?,
            primary_content: row.get("primary_content")?,
            links_json: row.get("links_json")?,
            source_file: row.get("source_file")?,
            source_rel_path: row.get("source_rel_path")?,
            raw_yaml: row.get("raw_yaml")?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query(text: &str, types: &[&str], tags: &[&str]) -> SearchQuery {
        SearchQuery {
            text: text.into(),
            filter: FilterState {
                types: types.iter().map(|s| (*s).into()).collect(),
                tags: tags.iter().map(|s| (*s).into()).collect(),
            },
            limit: 25,
            offset: 50,
        }
    }

    #[test]
    fn orders_by_rank_from_the_fts_match_with_text() {
        let sql = build_search_sql(&query("docker", &["commands"], &["infra"]));
        assert!(
            sql.sql
                .contains("FROM entries_fts(?) fts CROSS JOIN entries e ON e.rowid = fts.rowid")
        );
        assert!(
            sql.sql.contains(
                "WHERE e.type IN (?) AND EXISTS (SELECT 1 FROM entry_tags WHERE entry_id = e.id AND tag = ?)"
            )
        );
        assert!(sql.sql.ends_with("ORDER BY fts.rank LIMIT ? OFFSET ?"));
        assert_eq!(sql.params.len(), 5);
    }

    #[test]
    fn orders_by_title_without_text() {
        let sql = build_search_sql(&query("  ", &[], &[]));
        assert_eq!(
            sql.sql,
            "SELECT e.* FROM entries e ORDER BY e.title ASC LIMIT ? OFFSET ?"
        );
        assert_eq!(sql.params.len(), 2);
    }
}
