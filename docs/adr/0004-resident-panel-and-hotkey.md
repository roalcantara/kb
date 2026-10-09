# 0004. A resident panel opened by a global hotkey

- Status: accepted
- Date: 2026-10-08

## Context

Raycast keeps running and shows kb in a floating panel. A port launched as an ordinary app would compare its cold
start with Raycast's warm one.

## Decision

`kb-app` runs resident without a Dock icon, registers a global hotkey with the `global-hotkey` crate, and shows a
GPUI pop-up window that hides on Esc or when it loses focus. All of it lives in `crates/kb-app/src/panel.rs`.

## Consequences

Tier 3 compares warm with warm. The hotkey is the only piece outside GPUI Kit.

Two platform details, found while building it:

- Showing the app again after a hide delivers one stale deactivation before the activation it asked for, so the
  panel hides on blur only when the window is still inactive 100 ms later.
- AppleScript key events (`osascript … keystroke`) pull focus back to the calling app and hide the panel; scripted
  tests and the tier 3 harness post keys with CGEvent instead.
