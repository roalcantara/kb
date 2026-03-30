import type { OptsDef } from '@kli/core/cli'
import { runCommand } from '../main.cli.ts'
import { buildKliHandle, type CreateKliInput, type KliHandle } from './create_kli_handle.factory.ts'

/**
 * Creates a strongly-typed CLI with full dispatch (dev / tests), including optional OpenTUI when
 * `cli.tui` is set and argv has no subcommand.
 *
 * For compiled headless binaries use {@link createKliHeadless} so the bundle never pulls `@opentui/*`.
 */
export const createKli = <const DepsT extends Record<string, unknown>, const GlobalsT extends OptsDef>(
  input: CreateKliInput<DepsT, GlobalsT>
): KliHandle<DepsT, GlobalsT> => buildKliHandle(input, runCommand)
