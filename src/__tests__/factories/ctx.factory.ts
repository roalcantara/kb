import type { GreeterInput } from '@core'

/** Injected deps for `createKli` in `src/shell/main.ts`. */
export type ShellDeps = {
  greeter: (input: GreeterInput) => string
}

/** Minimal context shape for `info` command `run` (unit tests via `testCommand`). */
export type InfoCommandTestCtx = {
  deps: ShellDeps
  args: { path: string }
  opts: { source: string }
  globals: { verbose: boolean; debug: boolean; format?: string }
}

export const makeDeps = (overrides?: Partial<ShellDeps>): ShellDeps => ({
  greeter: () => 'Hello',
  ...overrides
})

export const makeCtx = (overrides?: Partial<InfoCommandTestCtx>): InfoCommandTestCtx => ({
  deps: makeDeps(overrides?.deps),
  args: { path: '~/.config/kodexb/config.yml', ...overrides?.args },
  opts: { source: '~/.config/kodexb/sources', ...overrides?.opts },
  globals: { verbose: false, debug: false, ...overrides?.globals }
})
