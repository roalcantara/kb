// TYPES
// =============================================================================
export type WrappedFactoryOpts<R, P = Partial<R>> = {
  overrides?: P
  associations?: Partial<R>
  transient?: Record<string, unknown>
  afterBuild?: (result: R) => R
}
export type FactoryBuildOpts<R, P = Partial<R>> = P | WrappedFactoryOpts<R, P>

// BASIC HELPERS
// =============================================================================
const OPTION_KEYS = ['overrides', 'afterBuild', 'associations', 'transient'] as const

/**
 * True when `opts` is the wrapped factory form (`{ overrides?, afterBuild?, … }`)
 * rather than a plain partial of the built type.
 */
export function isFactoryOpts(obj: unknown): obj is WrappedFactoryOpts<unknown> {
  return !!obj && typeof obj === 'object' && OPTION_KEYS.some(k => k in (obj as object))
}
