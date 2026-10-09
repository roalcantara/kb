//! The kb search panel: a resident GPUI Kit app over `kb-domain`, opened by a global hotkey.
//!
//! `main` only resolves the configuration and calls [`run`]; everything else is a module here,
//! so the UI integration tests build the same views the app shows.

pub mod config;
pub mod presentation;

#[cfg(test)]
mod fixture;
