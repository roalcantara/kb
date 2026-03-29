import { describe, expect, it, spyOn } from 'bun:test'
import { runMinimalCli } from './minimal_cli.runner.ts'
import type { MinimalCliConfig } from './minimal_cli.schema.ts'

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

/** Minimal-cli style argv (`runtime`, `script`, …user). */
const fakeArgv = (...tokens: string[]): string[] => ['/bun', 'script.ts', ...tokens]

describe('minimal CLI runner', () => {
  it.each([
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

  it('dispatches to registered command', () => {
    const log = spyOn(console, 'log').mockImplementation(VOID)
    const code = runMinimalCli(SAMPLE_CONFIG, fakeArgv('echo', 'hi', 'there'))
    expect(code).toBe(0)
    expect(log).toHaveBeenCalledWith('hi there')
    log.mockRestore()
  })

  it('unknown command exits with error', () => {
    const log = spyOn(console, 'log').mockImplementation(VOID)
    const err = spyOn(console, 'error').mockImplementation(VOID)
    const code = runMinimalCli(SAMPLE_CONFIG, fakeArgv('nope'))
    expect(code).toBe(1)
    expect(err).toHaveBeenCalled()
    log.mockRestore()
    err.mockRestore()
  })
})
