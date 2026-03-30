import type { ArgsDef, CliCommand, OptsDef, ParseResult } from '@kli/core/cli'
import type { CliInstance } from '../cli/factories/cli_instance.factory.ts'

import { pickResolvedGlobals } from './commands/index.ts'

export type TuiRootProps = {
  deps: unknown
  globals: Record<string, unknown>
  commandCount: number
}

/** Solid / OpenTUI root registered on {@link CliInstance#tui}. */
export type TuiRoot = (props: TuiRootProps) => unknown

/**
 * Mounts the registered TUI via dynamic OpenTUI imports (pipe / non-TTY pays no load cost).
 *
 * Not exported from the public kli barrel.
 */
export const startTui = async <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  App: TuiRoot,
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  parsed: ParseResult
): Promise<number> => {
  const globals = pickResolvedGlobals(parsed.opts, cli.globals)
  const [{ createCliRenderer }, { render }] = await Promise.all([import('@opentui/core'), import('@opentui/solid')])
  const renderer = await createCliRenderer({ exitOnCtrlC: true })
  await render(
    () =>
      App({
        deps: cli.deps,
        globals,
        commandCount: cli.commands.length
      }),
    renderer
  )
  return 0
}
