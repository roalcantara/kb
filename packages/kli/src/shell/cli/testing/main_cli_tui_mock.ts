import { mock } from 'bun:test'

/** Side-effect: register before `./main.cli.ts` is loaded in specs. */
export const mockStartTui = mock(() => Promise.resolve(0))

mock.module(new URL('../../tui/main.tui.ts', import.meta.url).href, () => ({
  startTui: mockStartTui
}))
