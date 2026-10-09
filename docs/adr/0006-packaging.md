# 0006. Packaged as a `.app` by cargo-packager

- Status: accepted
- Date: 2026-10-09

## Context

A binary started from a terminal is not a shippable Mac app: it has no bundle id, icon or `LSUIElement`, so it shows
in the Dock while the panel runs, and it cannot be added to Login Items, signed as an app or notarized.

## Decision

`cargo-packager` (pinned in `mise.toml`) builds `target/packager/kb.app` from `[package.metadata.packager]` in
`crates/kb-app/Cargo.toml`: bundle id `dev.roalcantara.kb` (also `kb_app::APP_ID`, GPUI's app identity),
`background-app = true` for `LSUIElement`, macOS 13 at least, and `assets/icon.icns`. `mise run package` signs it ad
hoc; `mise run install` copies it to `~/Applications`. The icon is drawn by `tools/icon/icon.swift` and converted by
`tools/icon/icns.sh`, so it can be regenerated.

Writing the `Info.plist` and the bundle layout by hand was the alternative; the packager does both, and also builds
DMGs when distribution needs one.

## Consequences

- An ad hoc signature runs only on the machine that made it. Distribution needs a Developer ID, the hardened runtime
  and notarization; the README lists the commands. Not done for the MVP.
- The packager runs `cargo build --release --locked -p kb-app` itself, so the `.app` holds exactly the binary the size
  budget checks.
