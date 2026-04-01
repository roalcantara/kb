/** Tiny in-process cache for `kb ls` — invalidated via `kb cache --invalidate`. */

const store = new Map<string, unknown>()

export const lsQueryCache = {
  get: (key: string): unknown | undefined => store.get(key),
  set: (key: string, value: unknown): void => {
    store.set(key, value)
  },
  clear: (): void => {
    store.clear()
  },
  size: (): number => store.size
}
