# kb

A native macOS panel for searching a personal YAML knowledge base, by keyboard.

## Register

Product.

## Users

- The owner: a keyboard-first developer who keeps commands, bookmarks, cheats, notes and tasks in YAML source files, and
  opens kb dozens of times a day.
- The coding agents that work on kb. They read this file, [AGENTS.md](AGENTS.md), [CONTEXT.md](CONTEXT.md) and
  [DESIGN.md](DESIGN.md) before changing it.

## Problem

The same search lives today as a Raycast extension. Raycast limits what an extension may be (window size, runtime,
memory), and reaching the search costs two or three steps through Raycast's root search. For a tool opened that often,
both add up.

## Product Purpose

Find and use an entry in two keystrokes after ⌥K: type a few letters, press Return. The experiment's success criteria
decide whether the native port earns its place
([experiment design, "Report"](docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md)).

## Brand Personality / Tone

Quiet, fast, native. kb looks and speaks like Raycast: Title Case labels, short verbs ("Open in Browser", "Copy
Command"), no exclamation marks, no chatter.

## Anti-references

- A web page in a window.
- Centred modal dialogs for anything that belongs to a control.
- Dense dashboards: colour, borders and counters everywhere.
- Anything slower than typing.

## Design Principles

1. **Keyboard first.** Every action has a shortcut, and the shortcut is shown where the action is.
2. **Copy Raycast, adapt on purpose.** Raycast's kb Search is the reference; every departure is recorded in
   [DESIGN.md](DESIGN.md#adaptations), with its reason.
3. **Overlays open where they are invoked.** Actions above the Actions button, filters under the filter button.
4. **Never block typing.** Search, sync and rendering never stall a keystroke.
5. **As large as the task.** Two window sizes, compact and expanded, one shortcut apart (⌘⇧F).

## Accessibility & Inclusion

- Text meets WCAG 2.2 AA contrast on every surface it sits on; `tools/design/validate.mjs` checks the palette.
- Nothing is told by colour alone: a tag carries its `#name`, a type its icon and tooltip.
- Every control is named for assistive technology ([compliance checklist](docs/experiment/compliance.md)).

## Offer

Free, for personal use. No pricing, no accounts, no telemetry.

## Boundaries

- Reads source files; never writes them.
- One user, one machine.
- macOS first; other platforms only where GPUI Kit gives them for free.

## Stack

Architecture, commands and rules: [AGENTS.md](AGENTS.md). Vocabulary: [CONTEXT.md](CONTEXT.md). Visual design:
[DESIGN.md](DESIGN.md).
