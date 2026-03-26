import type { BuildOptions as FisheryBuildOpts } from 'fishery'
import type { WrappedFactoryOpts } from './factories.types'

// HELPERS
// =============================================================================

export const params_for = <R>(
  w: Pick<WrappedFactoryOpts<R, unknown>, 'associations' | 'transient'>
): FisheryBuildOpts<R, unknown> | undefined => {
  const out: FisheryBuildOpts<R, unknown> = {}
  if (w.associations !== undefined) out.associations = w.associations
  if (w.transient !== undefined) out.transient = w.transient
  return Object.keys(out).length > 0 ? out : undefined
}
