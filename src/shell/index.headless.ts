/**
 * Production/CI compiled binary entry: CLI only (no `main.tui.tsx`, no OpenTUI
 * in the bundle graph). Cross-target `bun build --compile` must not resolve
 * `@opentui/core-*` platform packages.
 *
 * Local dev continues to use {@link ./index.ts} (TUI when not headless).
 */
import { greetCommand, infoCommand } from './commands'
import { formatEmitter } from './interceptors'
import { shell } from './main.ts'
import { runCliMain } from './run_cli_main.ts'

const commands = [infoCommand, greetCommand] as const

export const runCli = shell.setup({
  commands,
  emitter: formatEmitter
})

runCliMain(runCli)
