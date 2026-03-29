import { expect, spyOn, test } from 'bun:test'
import { testCommand } from '@kb/kli/testing'

import { makeCtx } from '../../__tests__/factories/ctx.factory.ts'
import { runCli } from '../index.ts'
import { infoCommand } from './info.command.ts'

const RAW_LINE_STARTS_WITH_CLI_TAB = /^cli\t/

const argvPrefix = (...tokens: string[]): string[] => ['bun', 'index.ts', ...tokens]

/** Joins all `console.log` arguments from the spy (handles pretty-printed JSON across one call). */
const emittedLogText = (log: { mock: { calls: unknown[][] } }): string =>
  log.mock.calls
    .map(c => c.map(String).join(' '))
    .join('\n')
    .trim()

test('info via testCommand + makeCtx exits 0 (return value; no emitter in unit path)', async () => {
  // `testCommand` is typed with widened `ArgsDef`/`OptsDef`; concrete commands need a harness cast.
  const result = await testCommand(infoCommand as never, makeCtx() as never)
  expect(result.exitCode).toBe(0)
  expect(result.stdout).toBe('')
})

test('info --json prints valid JSON and exit 0', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const code = await runCli(argvPrefix('info', '--json'))
  expect(code).toBe(0)
  const text = emittedLogText(log)
  const parsed = JSON.parse(text) as { cli: string; hasGreeter: boolean }
  expect(parsed.cli).toBe('kb')
  expect(typeof parsed.hasGreeter).toBe('boolean')
  log.mockRestore()
})

test('info -j prints valid JSON and exit 0', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const code = await runCli(argvPrefix('info', '-j'))
  expect(code).toBe(0)
  const parsed = JSON.parse(emittedLogText(log)) as { cli: string }
  expect(parsed.cli).toBe('kb')
  log.mockRestore()
})

test('info --yaml prints YAML-shaped lines and exit 0', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const code = await runCli(argvPrefix('info', '--yaml'))
  expect(code).toBe(0)
  const text = emittedLogText(log)
  expect(text).toContain('cli:')
  expect(text).toContain('hasGreeter:')
  log.mockRestore()
})

test('info -y prints YAML-shaped lines and exit 0', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const code = await runCli(argvPrefix('info', '-y'))
  expect(code).toBe(0)
  expect(emittedLogText(log)).toContain('cli:')
  log.mockRestore()
})

test('info --raw prints tab-separated fields and exit 0', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const code = await runCli(argvPrefix('info', '--raw'))
  expect(code).toBe(0)
  const text = emittedLogText(log)
  expect(text).toContain('\t')
  expect(text).toMatch(RAW_LINE_STARTS_WITH_CLI_TAB)
  log.mockRestore()
})

test('info -r prints tab-separated fields and exit 0', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const code = await runCli(argvPrefix('info', '-r'))
  expect(code).toBe(0)
  expect(emittedLogText(log)).toContain('\t')
  log.mockRestore()
})
