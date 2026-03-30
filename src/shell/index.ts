/** Inlined by `build:prod` via `--define KB_HEADLESS_BUILD=true`. */
declare const KB_HEADLESS_BUILD: boolean | undefined

import { defineGreetCommand, defineInfoCommand } from './cli/commands/index.ts'
import { runCliMain } from './cli/entry/main.run.ts'
import { defineFormatEmitter } from './cli/interceptors/format.emitter.ts'
import { shell } from './cli/main.cli.ts'

const commands = [defineInfoCommand(shell), defineGreetCommand(shell)] as const
const formatEmitter = defineFormatEmitter(shell)
const isHeadless = typeof KB_HEADLESS_BUILD !== 'undefined' && KB_HEADLESS_BUILD === true

export const runCli = isHeadless
  ? shell.setup({
      commands,
      emitter: formatEmitter
    })
  : shell.setup({
      commands,
      emitter: formatEmitter,
      tui: (await import('./tui/main.tui.tsx')).ShellTuiApp
    })

runCliMain(runCli, import.meta.main)
