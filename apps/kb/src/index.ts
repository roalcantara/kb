import { commands } from './shell/cli/commands/commands.ts'
import { runCliMainWithOptionalTui } from './shell/cli/factories/run_cli_main.factory.ts'
import { shell } from './shell/cli/main.ts'

export * from './shell/cli/emitter'

export const runCli = await runCliMainWithOptionalTui({ shell, commands, isEntry: import.meta.main })
