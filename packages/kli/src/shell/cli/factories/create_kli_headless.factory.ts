import type { OptsDef } from '@kli/core/cli'
import { runCommand } from '../run_command.headless.ts'
import { type CreateKliInput, buildKliHandle, type KliHandle } from './create_kli_handle.factory.ts'

/** Same as {@link createKli} but uses headless-only dispatch (no OpenTUI modules in the bundle graph). */
export const createKliHeadless = <const DepsT extends Record<string, unknown>, const GlobalsT extends OptsDef>(
  input: CreateKliInput<DepsT, GlobalsT>
): KliHandle<DepsT, GlobalsT> => buildKliHandle(input, runCommand)
