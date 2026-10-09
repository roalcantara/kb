# 0003. Render mermaid natively

- Status: deferred (design decision D8, 2026-10-09)
- Date: 2026-10-08

## Context

The TypeScript engine turns a `mermaid` notes block into an image served by `mermaid.ink`: it needs the network
and sends the diagram source to a third party.

## Decision

The Markdown keeps the TypeScript engine's output byte for byte. `kb-app` renders those image references, when
they point at `mermaid.ink`, with the `merman` crate instead, offline.

## Consequences

Diagrams render offline and privately. `merman` adds to the binary; its size is reported separately.

## Update, 2026-10-09

Deferred out of the MVP by the owner (D8). `kb-app` shows the `mermaid.ink` image the Markdown links, as Raycast
does; `merman` is the first follow-up after the experiment.
