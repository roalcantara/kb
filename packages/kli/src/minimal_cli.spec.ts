import { describe, expect, spyOn, test } from 'bun:test'

import { type MinimalCliConfig, runMinimalCli } from './minimal_cli.ts'

const VOID = (): undefined => undefined

const SAMPLE_CONFIG: MinimalCliConfig = {
  programName: 'demo',
  description: 'Demo CLI',
  version: '2.0.0',
  commands: [
    {
      name: 'echo',
      helpLine: 'echo <msg>   Print a message',
      run: positionalArgs => {
        console.log(positionalArgs.join(' '))
      }
    }
  ]
}

function fakeArgv(...tokens: string[]): string[] {
  return ['/bun', 'script.ts', ...tokens]
}

describe('minimal CLI runner', () => {
  test.each([
    ['no args', [] as string[]],
    ['-h', ['-h']],
    ['--help', ['--help']]
  ])('%s prints help', (_label, tokens) => {
    const log = spyOn(console, 'log').mockImplementation(VOID)
    const code = runMinimalCli(SAMPLE_CONFIG, fakeArgv(...tokens))
    expect(code).toBe(0)
    expect(log).toHaveBeenCalled()
    const out = log.mock.calls[0]?.[0] as string
    expect(out).toContain('Usage:')
    expect(out).toContain('demo <command>')
    log.mockRestore()
  })

  test('dispatches to registered command', () => {
    const log = spyOn(console, 'log').mockImplementation(VOID)
    const code = runMinimalCli(SAMPLE_CONFIG, fakeArgv('echo', 'hi', 'there'))
    expect(code).toBe(0)
    expect(log).toHaveBeenCalledWith('hi there')
    log.mockRestore()
  })

  test('unknown command exits with error', () => {
    const log = spyOn(console, 'log').mockImplementation(VOID)
    const err = spyOn(console, 'error').mockImplementation(VOID)
    const code = runMinimalCli(SAMPLE_CONFIG, fakeArgv('nope'))
    expect(code).toBe(1)
    expect(err).toHaveBeenCalled()
    log.mockRestore()
    err.mockRestore()
  })
})
