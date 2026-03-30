<!-- markdownlint-disable-file -->
# KLI — Typed run context — Tasks

## CHECKLIST

- [x] **1.** Add spec artefacts under `assets/docs/specs/kli/typed-run-context/`
  — _Req 4_

- [x] **2.** Provide flattened `ctx.args` / `ctx.opts` / `ctx.globals` maps in
  the handler context — _Req 1_

- [x] **3.** Keep `ctx.raw` as the parsed argv object for escape hatches — _Req 3_

- [x] **4.** Tests cover merge + globals slice + validation gating handler execution
  — _Req 4.1_

- [x] **5.** Consumer commands read scalars directly (no `.value`) — _Req 4.2_

## DEFERRED (future work)

- [ ] **F1.** Introduce provenance/cells for args/opts (`{ value, source, isPresent, isValid }`)
- [ ] **F2.** Add provenance regression tests (`argv` vs `env` vs `default`)
