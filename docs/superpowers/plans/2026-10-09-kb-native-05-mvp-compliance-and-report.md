# kb native port — Plan 5: MVP compliance, packaging, and report

> **Status:** takeover plan reconstructed from the unfinished `wip5` branch and now tracked here.

## Goal

Close the experiment as a shippable MVP and produce the final comparison report.

Plan 5 has two halves:

1. **MVP compliance and packaging** — align `kb-app` with GPUI Kit coding/design guides, Rust practices, and macOS app packaging expectations.
2. **Measurement and reporting** — run tier 2/3 probes on both apps, then generate `docs/experiment/report.md` from verified evidence.

## What is already done in this takeover commit

### Half 1 — MVP compliance and packaging

- Theme follows system appearance (not forced dark), with a UI test for it.
- Startup and runtime failures are surfaced as in-app notifications.
- Action labels use sentence case and command ellipsis rules from GPUI guidance.
- Added app-level quit action (`⌘Q` / "Quit kb") for a menu-less background app.
- Narrowed `kb-app` crate surface to what `main` and tests need.
- Replaced `#[allow(...)]` with `#[expect(..., reason = ...)]` where suppression remains intentional.
- Added packaging metadata (`cargo-packager`) for `kb.app`, with bundle identity and macOS `LSUIElement` behavior.
- Added reproducible icon pipeline (`tools/icon/icon.swift`, `tools/icon/icns.sh`) and checked-in `icon.icns`.
- Documented packaging decision in `docs/adr/0006-packaging.md`.
- Added and documented compliance checklist in `docs/experiment/compliance.md`.

### Half 2 — Measurement/reporting infrastructure

- Added shared CGEvent probe (`bench/probes/probe.swift`) and probe build task (`mise run probes`).
- Added tier 2/3 probe scripts for memory, footprint, CPU, latency, action timing, and maintainability.
- Added `xtask` crate to parse results/docs and generate a final experiment report.
- Added `mise run report` to gate + parity-check + report generation workflow.
- Updated methodology/parity/readme/context docs to reflect these workflows.

## Remaining work (the original unfinished part)

- [ ] Collect **fresh tier 2** measurements for both apps (`memory`, `footprint`, `cpu`, `size`) on the target machine/session.
- [ ] Collect **fresh tier 3** measurements for both apps (`show`, `action`, and kb internal traces).
- [ ] Capture Raycast keystroke→list update timing via the documented manual high-fps method.
- [ ] Run `mise run report` to generate `docs/experiment/report.md` from current results.
- [ ] Review report pass/fail against experiment success criteria and document any unmet criteria.

## Execution checklist

```bash
mise run gate
mise run parity
mise run package
mise run bench:memory kb
mise run bench:memory raycast
mise run bench:e2e kb
mise run bench:e2e raycast
mise run bench:maint
cargo run --quiet --locked -p xtask -- report --verified
```

## Deliverables

- `docs/experiment/report.md` generated from current result files.
- Updated `docs/experiment/results/*.json` runs for tier 2/3 from the same measurement window.
- If any criterion fails, a short remediation note linked from the report.
