//! The kb engine.
//!
//! A port of `packages/domain/kb` from the Raycast extension: the entry model, source file
//! scanning, notes Markdown, the SQLite index and its queries. It has no UI dependency; the
//! `domain-purity` hk step fails any change that gives it one.

#![warn(missing_docs)]
