# 0004. A resident panel opened by a global hotkey

- Status: accepted
- Date: 2026-10-08

## Context

Raycast keeps running and shows kb in a floating panel. A port launched as an ordinary app would compare its cold
start with Raycast's warm one.

## Decision

`kb-app` runs resident without a Dock icon, registers a global hotkey with the `global-hotkey` crate, and shows a
GPUI pop-up window that hides on Esc or when it loses focus. Both live in `main`, `panel` and `hotkey` alone.

## Consequences

Tier 3 compares warm with warm. The hotkey is the only piece outside GPUI Kit.
