//! The kb engine.
//!
//! A port of `packages/domain/kb` from the Raycast extension: the entry model, source file
//! scanning, notes Markdown, the SQLite index and its queries. It has no UI dependency; the
//! `domain-purity` hk step fails any change that gives it one.
//!
//! Index a sources directory, then search it:
//!
//! ```
//! use std::sync::atomic::AtomicBool;
//!
//! use kb_domain::search::{FilterState, PAGE_SIZE, SearchQuery, search};
//! use kb_domain::sync::{open_readonly, sync_knowledge_base};
//!
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! let dir = tempfile::tempdir()?;
//! let (sources, database) = (dir.path().join("sources"), dir.path().join("kb.db"));
//! std::fs::create_dir(&sources)?;
//! let yaml = "commands:\n  docker ps -a:\n    title: List containers\n";
//! std::fs::write(sources.join("commands.yml"), yaml)?;
//!
//! sync_knowledge_base(&sources, &database, &AtomicBool::new(false), |_| {})?;
//! let query = SearchQuery {
//!     text: "contain".into(),
//!     filter: FilterState::default(),
//!     limit: PAGE_SIZE,
//!     offset: 0,
//! };
//! let rows = search(&open_readonly(&database)?, &query)?;
//! assert_eq!(rows[0].primary_content, "docker ps -a");
//! # Ok(())
//! # }
//! ```

#![warn(missing_docs)]

pub use rusqlite::Connection;

pub mod entry;
pub mod markdown;
pub mod query;
pub mod report;
pub mod row;
pub mod search;
pub mod source;
pub mod sync;
pub mod yaml;
