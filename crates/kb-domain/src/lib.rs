//! The kb engine.
//!
//! A port of `packages/domain/kb` from the Raycast extension: the entry model, source file
//! scanning, notes Markdown, the SQLite index and its queries. It has no UI dependency; the
//! `domain-purity` hk step fails any change that gives it one.

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
