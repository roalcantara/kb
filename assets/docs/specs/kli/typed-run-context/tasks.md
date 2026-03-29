<!-- markdownlint-disable-file -->
# KLI — Typed run context — Tasks

## CHECKLIST

- [x] **1.** Add spec artefacts under `assets/docs/specs/kli/typed-run-context/`
  — _Req 4_

- [x] **2.** Export `expandFileValue` from `parse_argv` (or shared helper) for
  default file paths in validation — _Req 1, design_

- [x] **3.** Extend `ArgDef` with optional `default` (scalar) for parity with
  opts — _Req 1_

- [x] **4.** Add `ResolvedArgsMap`, `ResolvedLocalOptsMap`, `ResolvedGlobalsMap`,
  `RunHandlerContext` in `with_command.ts`; wire `CliCommand.run` and command
  middleware — _Req 1–2_

- [x] **5.** Refactor `validate_command.ts` to output `args` / `opts` as cell
  records; keep `globals` flat slice — _Req 1, 3_

- [x] **6.** Update `run_command.ts` to pass typed context without erasing
  cells — _Req 1–2_

- [x] **7.** Export new types from `packages/kli/src/index.ts` — _Req 2_

- [x] **8.** Update `testing.ts` / `testCommand` context typing — _Req 4_

- [x] **9.** Update `validate_command.spec.ts`, `run_command.spec.ts`; add
  provenance tests — _Req 4.1_

- [x] **10.** Update app `timing.middleware`, `info.command`, `greet.command` —
  _Req 4.2_
