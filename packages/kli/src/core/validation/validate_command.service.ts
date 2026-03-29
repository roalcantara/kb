import { err, ok, type Result } from 'neverthrow'
import type { CommandDef, EnvMap, OptsDef, ParseResult, ScalarValue } from '../parsing/argv.schema.ts'
import {
  buildArgCells,
  buildOptCells,
  flattenArgScalars,
  flattenOptScalars,
  splitGlobalAndLocalOpts,
  validateMergedOptsShape
} from './validation_cells.ts'

export type ResolvedContext = {
  args: Record<string, ScalarValue | ScalarValue[] | undefined>
  /** Command-local flags only (from `command.opts`). */
  opts: Record<string, ScalarValue | undefined>
  /** CLI-wide flags (from `globalOpts`); keys shadowed by `command.opts` appear only in `opts`. */
  globals: Record<string, ScalarValue | undefined>
}

/**
 * Validates a {@link ParseResult} for a specific command: required args/opts, either conflicts, file paths.
 *
 * @param parsed - Output of {@link parseArgv}
 * @param command - Command definition (args/opts schemas)
 * @param globalOpts - CLI-wide option definitions merged with `command.opts`
 * @param env - Environment for env-backed opts and file expansion
 * @returns `ok` with `args`, command-local `opts`, and `globals`; or `err` with human-readable messages
 *
 * @example
 * const parsed = parseArgv(argv, globals, [cmd])
 * validateCommand(parsed, cmd, globals).match(
 *   v => runHandler(v),
 *   e => console.error(e.join('\n'))
 * )
 */
export const validateCommand = (
  parsed: ParseResult,
  command: CommandDef,
  globalOpts: OptsDef = {},
  env: EnvMap = Bun.env
): Result<ResolvedContext, string[]> => {
  const errors = [...parsed.errors]

  const mergedOptionDefs = { ...globalOpts, ...(command.opts ?? {}) }
  validateMergedOptsShape(parsed, mergedOptionDefs, env, errors)

  const argCells = buildArgCells(parsed, command, env, errors)
  const optCells = buildOptCells(parsed, mergedOptionDefs, env, errors)

  if (errors.length > 0) return err(errors)

  const flatOpts = flattenOptScalars(mergedOptionDefs, optCells)
  const { opts, globals } = splitGlobalAndLocalOpts(flatOpts, globalOpts, command)

  return ok({
    args: flattenArgScalars(command, argCells),
    opts,
    globals
  })
}
