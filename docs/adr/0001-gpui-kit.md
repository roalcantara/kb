# 0001. GPUI Kit for the native UI

- Status: accepted
- Date: 2026-10-08

## Context

The port must reproduce Raycast's list, split pane, rendered Markdown with highlighted code, action palette and
navigation, natively and small. GPUI Kit (the `gpui-kit` crate) ships a virtualized `List`, `TextView` (Markdown
and HTML with an opt-in code highlighter), `Command`, `Popover`, `Resizable`, `NavStack`, `DescriptionList`,
`Tag`, `Kbd`, `Empty` and `Notification`.

## Decision

Build `kb-app` on GPUI Kit, pinned to one exact version.

## Consequences

Every Raycast surface maps to a GPUI Kit component except the global hotkey and the launcher panel (ADR 0004).
API churn is contained by the exact pin; upgrades are deliberate.
