#!/usr/bin/env bun
/**
 * Definition of Done check - runs after agent response.
 * Verifies: no compilation errors, no linter errors, no failing tests.
 * See docs/guides/DoD.md for full checklist.
 *
 * Cursor command-hook contract (https://cursor.com/docs/agent/third-party-hooks):
 * - Exit `0` → hook succeeded; stdout JSON is parsed and applied.
 * - Exit `2` → block the action (for hooks that support deny).
 * - Other exits (e.g. `1`) → hook *failed*; Cursor fail-opens and may ignore stdout.
 *
 * So we always exit `0` after writing JSON. `continue: false` (and optional
 * `user_message`) is the signal when checks fail — never pair `continue: false`
 * with a non-zero exit, or the UI may treat the hook as crashed and continue.
 */

import { readFileSync } from 'node:fs'

import { $ } from 'bun'

// Drain stdin (Cursor may pass hook context). Do not use `Bun.stdin.stream()` +
// `Response.text()` — it can hang indefinitely at EOF (known Bun issue).
let _stdin = ''
try {
  _stdin = readFileSync(0, 'utf8')
} catch {
  // stdin missing or not readable — proceed with DoD checks
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

// One JSON line on stdout; exit 0 so Cursor treats output as authoritative.
process.stdout.write(`${JSON.stringify(response)}\n`)
