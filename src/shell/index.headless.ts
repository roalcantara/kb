/**
 * Production/CI compiled binary entry: CLI only (no `main.tui.tsx`, no OpenTUI
 * in the bundle graph). Cross-target `bun build --compile` must not resolve
 * `@opentui/core-*` platform packages.
 *
 * Local dev continues to use {@link ./index.ts} (TUI when not headless).
 */
import { defineGreetCommand, defineInfoCommand } from './commands'
import { defineFormatEmitter } from './interceptors'
import { shell } from './main.headless.ts'
import { runCliEntry } from './run_cli_main.ts'

const commands = [defineInfoCommand(shell), defineGreetCommand(shell)] as const

const formatEmitter = defineFormatEmitter(shell)

export const runCli = shell.setup({
  commands,
  emitter: formatEmitter
})

runCliEntry(runCli)
