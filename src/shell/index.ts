import { greetCommand, infoCommand } from './commands'
import { formatEmitter } from './interceptors'
import { shell } from './main.ts'

export const runCli = shell.setup({
  commands: [infoCommand, greetCommand],
  emitter: formatEmitter
})
