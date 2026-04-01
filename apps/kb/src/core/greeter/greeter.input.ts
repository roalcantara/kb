/** biome-ignore-all lint/style/noMagicNumbers: numeric literal types for Typia tags (type-only, erased at compile) */
import type { tags } from 'typia'

export type GreeterInput = {
  name: string & tags.MinLength<1>
  times?: number & tags.Type<'uint32'> & tags.Minimum<1>
}
