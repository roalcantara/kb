/** Inlined by `build:prod` via `--define KB_HEADLESS_BUILD=true`. */
declare const KB_HEADLESS_BUILD: boolean | undefined

import { defineGreetCommand, defineInfoCommand } from './commands'
import { defineFormatEmitter } from './interceptors'
import { shell } from './main.ts'
import { runCliMain } from './run_cli_main.ts'

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
      tui: (await import('./main.tui.tsx')).ShellTuiApp
    })

runCliMain(runCli)
