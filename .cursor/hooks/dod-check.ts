#!/usr/bin/env bun
/**
 * Definition of Done check - runs after agent response.
 * Verifies: no compilation errors, no linter errors, no failing tests.
 * See docs/guides/DoD.md for full checklist.
 *
 * Cursor command-hook contract (https://cursor.com/docs/agent/third-party-hooks):
 * - Exit `0` → hook succeeded; stdout JSON is parsed and applied.
 * - Exit `2` → block the action (same as `permission: "deny"`).
 * - Other exits (e.g. `1`) → hook *failed*; Cursor fail-opens and may ignore stdout.
 *
 * On DoD failure we write `continue: false` + `user_message` on stdout *and* exit `2`.
 * Relying on exit `0` with only `continue: false` is unreliable in some Cursor builds;
 * exit `2` is the documented block signal.
 */

import { $ } from 'bun'

// Drain stdin (Cursor may pass hook context). Prefer `Bun.stdin` (BunFile) over
// node:fs. Skip when stdin is a TTY — `Bun.stdin.text()` would block for input.
// Do not use `Bun.stdin.stream()` + `Response.text()` — it can hang at EOF
// (known Bun issue); `Bun.stdin.text()` reads the blob until EOF on pipes.
let _stdin = ''
if (!process.stdin.isTTY) {
  try {
    _stdin = await Bun.stdin.text()
  } catch {
    // stdin not readable — proceed with DoD checks
  }
}

const checks: { name: string; run: () => ReturnType<typeof $> }[] = [
  { name: 'typecheck', run: () => $`bun run typecheck`.quiet().nothrow() },
  { name: 'lint', run: () => $`bun run lint`.quiet().nothrow() },
  { name: 'test', run: () => $`bun test`.quiet().nothrow() },
]

const failedNames: string[] = []
for (const { name, run } of checks) {
  // `.quiet()` keeps child output off this process's stdout so the only stdout
  // line is the hook JSON (Cursor parses stdout).
  const result = await run()
  if (result.exitCode !== 0) {
    console.error(`\n[DoD] ${name} FAILED (exit ${result.exitCode})`)
    const out = result.stdout.toString()
    const err = result.stderr.toString()
    if (out.trim()) console.error(out)
    if (err.trim()) console.error(err)
    failedNames.push(name)
  }
}

const failed = failedNames.length > 0
const response = failed
  ? {
      continue: false,
      user_message: `DoD failed: ${failedNames.join(', ')}. See [DoD] lines on stderr.`,
    }
  : { continue: true }

// One JSON line on stdout; exit `2` on failure so Cursor reliably blocks (see file header).
process.stdout.write(`${JSON.stringify(response)}\n`)
process.exit(failed ? 2 : 0)
