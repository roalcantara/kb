//! `tools/bench/fixtures/queries.json`, shared with `tools/bench/ts/query.ts`.

use kb_domain::search::{FilterState, PAGE_SIZE, SearchQuery};
use serde::Deserialize;

/// One benchmark query.
#[derive(Debug, Clone, Deserialize)]
pub struct BenchQuery {
    /// Its id, used in case names.
    pub id: String,
    /// The search text.
    pub text: String,
    /// Selected types.
    #[serde(default)]
    pub types: Vec<String>,
    /// Selected tags.
    #[serde(default)]
    pub tags: Vec<String>,
    /// Rows to skip.
    #[serde(default)]
    pub offset: usize,
}

impl BenchQuery {
    /// The query for one page.
    #[must_use]
    pub fn to_search_query(&self) -> SearchQuery {
        SearchQuery {
            text: self.text.clone(),
            filter: FilterState {
                types: self.types.clone(),
                tags: self.tags.clone(),
            },
            limit: PAGE_SIZE,
            offset: self.offset,
        }
    }
}
