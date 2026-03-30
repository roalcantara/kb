/** Inlined by `build:prod` via `--define KB_HEADLESS_BUILD=true`. */
declare const KB_HEADLESS_BUILD: boolean | undefined

import { greetCommand, infoCommand } from './commands'
import { formatEmitter } from './interceptors'
import { shell } from './main.ts'

const commands = [infoCommand, greetCommand] as const

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

if (import.meta.main) {
  ;(async () => {
    const code = await runCli(Bun.argv)
    if (code !== 0) process.exitCode = code
  })().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
