import { greetCommand, infoCommand } from './commands/index.ts'
import { shell } from './main.ts'

export const runCli = shell.setup(infoCommand, greetCommand)
