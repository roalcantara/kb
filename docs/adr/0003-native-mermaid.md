# 0003. Render mermaid natively

- Status: accepted
- Date: 2026-10-08

## Context

The TypeScript engine turns a `mermaid` notes block into an image served by `mermaid.ink`: it needs the network
and sends the diagram source to a third party.

## Decision

The Markdown keeps the TypeScript engine's output byte for byte. `kb-app` renders those image references, when
they point at `mermaid.ink`, with the `merman` crate instead, offline.

## Consequences

Diagrams render offline and privately. `merman` adds to the binary; its size is reported separately.
