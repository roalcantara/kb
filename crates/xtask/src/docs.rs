//! Reading the hand-written experiment documents: the parity matrix's tables and the
//! compliance checklist.

/// One row of a Markdown table, as the header names its cells.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Row {
    cells: Vec<(String, String)>,
}

impl Row {
    /// The cell under `column`, or "".
    pub fn get(&self, column: &str) -> &str {
        self.cells
            .iter()
            .find(|(name, _)| name == column)
            .map_or("", |(_, value)| value.as_str())
    }
}

/// Every row of every table in `markdown` whose header has all of `columns`.
pub fn table_rows(markdown: &str, columns: &[&str]) -> Vec<Row> {
    let mut rows = Vec::new();
    let mut header: Option<Vec<String>> = None;
    for line in markdown.lines().map(str::trim) {
        if !line.starts_with('|') {
            header = None;
            continue;
        }
        let cells = cells(line);
        match &header {
            None => header = Some(cells),
            Some(_) if cells.iter().all(|c| c.chars().all(|ch| ch == '-' || ch == ':')) => {}
            Some(names) if columns.iter().all(|c| names.iter().any(|n| n == c)) => rows.push(Row {
                cells: names.iter().cloned().zip(cells).collect(),
            }),
            Some(_) => {}
        }
    }
    rows
}

fn cells(line: &str) -> Vec<String> {
    let inner = line.trim_matches('|');
    inner.split('|').map(|cell| cell.trim().to_owned()).collect()
}

/// A checklist section: its heading, and its items with whether each is checked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Section {
    /// The `##` heading.
    pub title: String,
    /// Each `- [x]` or `- [ ]` item: checked, and its text.
    pub items: Vec<(bool, String)>,
}

/// The checklist items of `markdown`, grouped under their `##` headings.
pub fn checklist(markdown: &str) -> Vec<Section> {
    let mut sections: Vec<Section> = Vec::new();
    for line in markdown.lines() {
        if let Some(title) = line.strip_prefix("## ") {
            sections.push(Section {
                title: title.trim().to_owned(),
                items: Vec::new(),
            });
        } else if let Some(section) = sections.last_mut() {
            let item = line.trim_start();
            if let Some(text) = item.strip_prefix("- [x] ") {
                section.items.push((true, text.trim().to_owned()));
            } else if let Some(text) = item.strip_prefix("- [ ] ") {
                section.items.push((false, text.trim().to_owned()));
            }
        }
    }
    sections.retain(|section| !section.items.is_empty());
    sections
}

#[cfg(test)]
mod tests {
    use super::*;

    const MATRIX: &str = "\
## Surfaces

| #   | Behaviour | Status  | Justification |
| --- | --------- | ------- | ------------- |
| S01 | Search    | Same    |               |
| S02 | Split     | Adapted | ⌘D            |

| # | Task |
| - | ---- |
| T1 | Open |
";

    #[test]
    fn reads_the_rows_of_tables_with_the_named_columns() {
        let rows = table_rows(MATRIX, &["#", "Status"]);
        assert_eq!(rows.len(), 2);
        assert_eq!((rows[1].get("#"), rows[1].get("Status")), ("S02", "Adapted"));
        assert_eq!(rows[1].get("Justification"), "⌘D");
        assert_eq!(table_rows(MATRIX, &["Task"]).len(), 1);
    }

    #[test]
    fn groups_checklist_items_by_section() {
        let sections = checklist("# C\n\n## Rust\n\n- [x] one\n- [ ] two\n\n## Empty\n\ntext\n");
        assert_eq!(
            sections,
            [Section {
                title: "Rust".into(),
                items: vec![(true, "one".into()), (false, "two".into())],
            }]
        );
    }
}
