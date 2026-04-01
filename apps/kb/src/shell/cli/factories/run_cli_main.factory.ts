import { ResultAsync } from 'neverthrow'

import { defineFormatEmitter } from '../emitter/index.ts'
import { runCliMain } from './runner.factory.ts'

const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)))

type MakeRunCliOptions = {
  // biome-ignore lint/suspicious/noExplicitAny: shell.setup is generic; this HoF is wiring-only.
  shell: { setup: (options: any) => (argv: string[]) => Promise<number> }
  commands: readonly unknown[]
}

/**
 * HoF: builds `runCli` (always) and registers TUI only when on a TTY.
 */
const buildRunCliWithOptionalTui = async ({
  shell,
  commands
}: MakeRunCliOptions): Promise<(argv: string[]) => Promise<number>> => {
  const tui =
    process.stdout.isTTY === true
      ? await ResultAsync.fromPromise(
          import('../../tui/main.tui.tsx').then(m => m.ShellTuiApp),
          toError
        ).match(
          ShellTuiApp => ({ tui: ShellTuiApp }),
          err => {
            console.error('kb: failed to load TUI, continuing with CLI only:', err.message)
            return {}
          }
        )
      : {}

  return shell.setup({ commands, emitter: defineFormatEmitter(shell as never), ...tui })
}

/**
 * HoF: receives commands, optionally registers TUI, runs the CLI when this
 * module is the entrypoint, and returns the instantiated `runCli`.
 */
export const runCliMainWithOptionalTui = async ({
  shell,
  commands,
  isEntry
}: MakeRunCliOptions & { isEntry: boolean }): Promise<(argv: string[]) => Promise<number>> => {
  const runCli = await buildRunCliWithOptionalTui({ shell, commands })
  runCliMain(runCli, isEntry)
  return runCli
}
