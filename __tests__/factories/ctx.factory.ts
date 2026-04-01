/** Injected deps for `createKli` — empty for KodexB v1 stubs. */
export type ShellDeps = Record<string, never>

/** Minimal context for `config` command `run` (unit tests via `testCommand`). */
export type ConfigCommandTestCtx = {
  deps: ShellDeps
  args: Record<string, never>
  opts: { setup?: boolean; sync?: boolean }
  globals: {
    verbose: boolean
    debug: boolean
    config: string
    source: string
    db: string
    format?: string
  }
}

export const makeDeps = (): ShellDeps => ({})

type ConfigCommandTestCtxOverrides = Omit<Partial<ConfigCommandTestCtx>, 'globals'> & {
  globals?: Partial<ConfigCommandTestCtx['globals']>
}

export const makeCtx = (overrides?: ConfigCommandTestCtxOverrides): ConfigCommandTestCtx => {
  const base: ConfigCommandTestCtx = {
    deps: makeDeps(),
    args: {},
    opts: {},
    globals: {
      verbose: false,
      debug: false,
      config: '/tmp/kodexb-config.yaml',
      source: '/tmp/kodexb-sources',
      db: '/tmp/kodexb.db'
    }
  }
  return {
    ...base,
    ...overrides,
    deps: { ...base.deps, ...overrides?.deps },
    args: { ...base.args, ...overrides?.args },
    opts: { ...base.opts, ...overrides?.opts },
    globals: { ...base.globals, ...overrides?.globals }
  }
}
