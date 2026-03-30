import type { OptsDef, ScalarValue } from '@kli/core/cli'

/** Keeps only keys declared on `cli.globals` from the flat parse map. */
export const pickResolvedGlobals = (
  flatOpts: Record<string, ScalarValue>,
  globalSchema: OptsDef
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(globalSchema)) {
    if (Object.hasOwn(flatOpts, key)) out[key] = flatOpts[key]
  }
  return out
}
