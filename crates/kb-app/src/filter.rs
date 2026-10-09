//! The filter's choices: any of the selected types, and every selected tag.

use kb_domain::search::FilterState;

use crate::presentation::type_label;

/// One choice, checked when it is part of the current filter, and the filter picking it gives.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilterChoice {
    /// Its label.
    pub label: String,
    /// Whether it is part of the current filter.
    pub checked: bool,
    /// The filter after picking it.
    pub next: FilterState,
}

/// A labelled group of choices.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilterGroup {
    /// The group label.
    pub label: &'static str,
    /// Its choices, never empty.
    pub choices: Vec<FilterChoice>,
}

fn toggled(values: &[String], value: &str) -> Vec<String> {
    if values.iter().any(|v| v == value) {
        values.iter().filter(|v| *v != value).cloned().collect()
    } else {
        let mut next = values.to_vec();
        next.push(value.to_owned());
        next
    }
}

/// The choices for the index's `types` and `tags` under the `current` filter. Picking a checked
/// choice removes it; picking any other adds it.
#[must_use]
pub fn filter_groups(types: &[String], tags: &[String], current: &FilterState) -> Vec<FilterGroup> {
    let mut groups = Vec::new();
    if !current.types.is_empty() || !current.tags.is_empty() {
        groups.push(FilterGroup {
            label: "Filters",
            choices: vec![FilterChoice {
                label: "Clear All Filters".into(),
                checked: false,
                next: FilterState::default(),
            }],
        });
    }
    let type_choices: Vec<FilterChoice> = types
        .iter()
        .map(|t| FilterChoice {
            label: type_label(t),
            checked: current.types.contains(t),
            next: FilterState {
                types: toggled(&current.types, t),
                tags: current.tags.clone(),
            },
        })
        .collect();
    if !type_choices.is_empty() {
        groups.push(FilterGroup {
            label: "Types",
            choices: type_choices,
        });
    }
    let tag_choices: Vec<FilterChoice> = tags
        .iter()
        .map(|t| FilterChoice {
            label: format!("#{t}"),
            checked: current.tags.contains(t),
            next: FilterState {
                types: current.types.clone(),
                tags: toggled(&current.tags, t),
            },
        })
        .collect();
    if !tag_choices.is_empty() {
        groups.push(FilterGroup {
            label: "Tags",
            choices: tag_choices,
        });
    }
    groups
}

/// The filter in a few words, for the list placeholder: "All entries", "Commands", "Commands, #git".
#[must_use]
pub fn filter_summary(filter: &FilterState) -> String {
    let parts: Vec<String> = filter
        .types
        .iter()
        .map(|t| type_label(t))
        .chain(filter.tags.iter().map(|t| format!("#{t}")))
        .collect();
    if parts.is_empty() {
        "All entries".into()
    } else {
        parts.join(", ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| (*v).to_owned()).collect()
    }

    #[test]
    fn adds_an_unchecked_choice_and_removes_a_checked_one() {
        let current = FilterState {
            types: strings(&["commands"]),
            tags: Vec::new(),
        };
        let groups = filter_groups(&strings(&["commands", "notes"]), &strings(&["git"]), &current);
        assert_eq!(
            groups.iter().map(|g| g.label).collect::<Vec<_>>(),
            ["Filters", "Types", "Tags"]
        );
        let types = &groups[1].choices;
        assert_eq!(
            (
                types[0].label.as_str(),
                types[0].checked,
                types[0].next.types.is_empty()
            ),
            ("Commands", true, true)
        );
        assert_eq!(types[1].next.types, strings(&["commands", "notes"]));
        assert_eq!(
            groups[2].choices[0].next,
            FilterState {
                types: strings(&["commands"]),
                tags: strings(&["git"])
            }
        );
        assert_eq!(groups[0].choices[0].next, FilterState::default());
    }

    #[test]
    fn offers_no_clear_choice_without_a_filter() {
        let groups = filter_groups(&strings(&["notes"]), &[], &FilterState::default());
        assert_eq!(groups.iter().map(|g| g.label).collect::<Vec<_>>(), ["Types"]);
    }

    #[test]
    fn summarizes_the_filter() {
        assert_eq!(filter_summary(&FilterState::default()), "All entries");
        assert_eq!(
            filter_summary(&FilterState {
                types: strings(&["commands"]),
                tags: strings(&["git"])
            }),
            "Commands, #git"
        );
    }
}
