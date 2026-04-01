import { commands } from './shell/cli/commands/commands.ts'
import { runCliMainWithOptionalTui } from './shell/cli/factories/run_cli_main.factory.ts'
import { shell } from './shell/cli/main.ts'

export * from './shell/cli/emitter'

export const createRunCli = (options?: { isEntry?: boolean }) =>
  runCliMainWithOptionalTui({ shell, commands, isEntry: options?.isEntry ?? import.meta.main })

if (import.meta.main) {
  await createRunCli({ isEntry: true })
}
