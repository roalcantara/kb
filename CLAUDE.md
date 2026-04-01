claude
```

**Prompt 1:**
```
what does this project do?
```

Read the answer. If it mentions Boune, Zod, or anything not in the stack above — correct it now before writing a single line of code:
```
That's not quite right. Read assets/docs/specs/kb/design.md
and summarise the architecture in your own words.
```

**Prompt 2:**
```
Read assets/docs/specs/kb/tasks.md. What does REQUIREMENT 0 ask
us to build, and what's already done?
```

This forces Claude Code to read the actual tasks, not hallucinate them. You'll see it check the `[x]` boxes and understand what's already wired.

---

## Session 2 — Build the emitter (step 1 of REQUIREMENT 0)

One task per prompt. Never give Claude Code two things at once.

**Prompt 3:**
```
Implement step 1 of REQUIREMENT 0 from tasks.md exactly as specified.
That's the emitter module at apps/kb/src/shell/cli/emitter/.
Create formats.ts and emitter.ts. Follow the design in design.md —
the emitter is the ONLY place in shell that calls console.log for data output.
Do not modify any other files yet.
```

Claude Code will:
1. Read tasks.md to understand the spec
2. Read design.md for the emitter contract
3. Create the two files
4. Ask for your confirmation before writing

**Review before you say yes.** Check:
- Does `formats.ts` export `type Format = 'pretty' | 'json' | 'raw'`?
- Does `emitter.ts` have `formatAndWrite(payload: unknown, format: Format): void`?
- Is `json` doing `JSON.stringify(payload, null, 2)`?
- Is there any `console.log` in command files that shouldn't be there?

If something's wrong:
```
The pretty formatter is wrong. It should produce aligned columns,
not just JSON.stringify. Try again.
```

---

## Session 2 continued — Wire the format flag (step 2)

**Prompt 4:**
```
Now implement step 2 of REQUIREMENT 0 from tasks.md: wire the --format
global in the KLI definition at
apps/kb/src/shell/cli/entry/definition.kli.ts.

Format uses KLI's either group: -p/--pretty, -j/--json, -r/--raw,
default pretty. Also pass ctx.opts.format into the emitter in each
existing command stub. Do not implement command logic yet — just
wire the format flag through.
```

---

## Session 2 continued — Timing middleware (step 3)

**Prompt 5:**
```
Implement step 3 of REQUIREMENT 0: the timing middleware at
apps/kb/src/shell/cli/middleware/timing.ts.

When ctx.opts.debug is true, emit a structured line to stderr
after next() with the total wall time. The format is defined in
design.md under Observability: ts=<ISO> phase=command label=<name> dur_ms=<n>.
Register it in definition.kli.ts.
```

---

## Session 2 — Checkpoint

**Prompt 6:**
```
Run the checkpoint from tasks.md REQUIREMENT 0:
1. kb --help should list config, import, ls, view, db, cache
2. kb ls --format=json should produce [] on empty DB
3. kb ls --debug should show a debug line on stderr

Run these commands and show me the output.
```

This is the most important prompt of the session. Claude Code will actually run the commands via its shell tool and show you real output. If something fails it will iterate until the checkpoint passes.

---

## The pattern — use it for every requirement
```
1. "Read tasks.md. What does step N of REQUIREMENT X ask us to build?"
2. "Implement step N exactly as specified. Do not touch other files."
3. Review the diff before confirming
4. "Run the checkpoint for this step and show me the output."
5. If it drifts: "That's not what design.md says. Revert and try again."
```

---

## Practical rules you'll thank yourself for

**Use `/compact` when the conversation gets long.** At around 70% context Claude Code starts losing precision. Type `/compact` — it summarises the conversation and continues. Use it between requirements, not in the middle of a task.

**One task per prompt.** "Implement the emitter AND wire the format flag AND add middleware" will produce a mess. Each step in tasks.md is one prompt.

**Let it run tests.** When Claude Code says "should I run the tests?" — say yes. Always. It finds its own mistakes faster than you do.

**Git after each checkpoint.** When a checkpoint passes, commit. If Claude Code breaks something later you have a clean rollback point.

**When it hallucinates a dependency:**
```
We are not using [whatever it invented]. Check design.md for the approved stack.
```

**When it puts I/O in core:**
```
That file is under apps/kb/src/core/ which is the pure layer.
No I/O allowed there. Move the file read to shell/.