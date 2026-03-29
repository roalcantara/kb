import { describe, expect, it } from 'bun:test'
import type { CommandDef } from './argv.schema.ts'
import { parseArgv } from './argv_parse.service.ts'

const LIMIT_FIFTY = 50
const HOME_KEY = 'HOME'
const KLI_ROOT_KEY = 'KLI_ROOT'
const KLI_CONFIG_KEY = 'KLI_CONFIG'

type KnownOpts = {
  config?: string
  limit?: number
  verbose?: boolean
  format?: string
}

type KnownArgs = {
  target?: string
  files?: string[]
}

const COMMANDS: readonly CommandDef[] = [
  {
    name: 'build',
    args: {
      target: { type: 'string' },
      'files...': { type: 'string' }
    },
    opts: {
      config: { type: 'file', short: 'c', env: 'KLI_CONFIG', default: '~/default.yml' },
      limit: { type: 'number' },
      verbose: { type: 'boolean' },
      format: {
        type: 'string',
        either: { p: 'pretty', j: 'json' }
      }
    }
  }
]

/** Builds a Bun-style argv: runtime, script, then user tokens. */
const argv = (...tokens: string[]): string[] => ['/bun', 'index.ts', ...tokens]

/**
 * Test env map with a default `HOME` unless overridden.
 *
 * @param overrides - Extra or replacement env entries
 */
const env = (overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> => {
  const vars: Record<string, string | undefined> = { ...overrides }
  vars[HOME_KEY] = vars[HOME_KEY] ?? '/home/tester'
  return vars
}

/** Runs {@link parseArgv} against {@link COMMANDS} with synthetic argv/env. */
const parseKnown = (tokens: string[], overrides?: Record<string, string | undefined>) =>
  parseArgv(argv(...tokens), {}, COMMANDS, env(overrides))

describe('parse_argv options', () => {
  it('parses long and short flags with coercion', () => {
    expect((parseKnown(['build', '--config=/tmp/a.yml']).opts as KnownOpts).config).toBe('/tmp/a.yml')
    expect((parseKnown(['build', '--config', '/tmp/a.yml']).opts as KnownOpts).config).toBe('/tmp/a.yml')
    expect((parseKnown(['build', '-c', '/tmp/a.yml']).opts as KnownOpts).config).toBe('/tmp/a.yml')
    expect((parseKnown(['build', '--limit', '50']).opts as KnownOpts).limit).toBe(LIMIT_FIFTY)
    expect((parseKnown(['build', '--verbose']).opts as KnownOpts).verbose).toBe(true)
    expect((parseKnown(['build', '--no-verbose']).opts as KnownOpts).verbose).toBe(false)
  })

  it('supports either groups and conflicts', () => {
    expect((parseKnown(['build', '-p']).opts as KnownOpts).format).toBe('pretty')
    expect((parseKnown(['build', '--pretty']).opts as KnownOpts).format).toBe('pretty')
    expect((parseKnown(['build', '--format', 'json']).opts as KnownOpts).format).toBe('json')
    const conflict = parseKnown(['build', '-p', '-j'])
    expect(conflict.errors).toHaveLength(1)
    expect(conflict.errors[0]).toContain('Either conflict')
  })
})

describe('parse_argv fallback and expansion', () => {
  it('expands file values and env fallback', () => {
    const envWithRoot = env()
    envWithRoot[KLI_ROOT_KEY] = 'workspace'
    expect(
      (parseArgv(argv('build', '--config', '~/cfg/$KLI_ROOT.yml'), {}, COMMANDS, envWithRoot).opts as KnownOpts).config
    ).toBe('/home/tester/cfg/workspace.yml')

    const envWithConfig = env()
    envWithConfig[KLI_CONFIG_KEY] = '/env/config.yml'
    expect((parseArgv(argv('build'), {}, COMMANDS, envWithConfig).opts as KnownOpts).config).toBe('/env/config.yml')
  })

  it('uses default when env and flag are absent', () => {
    expect((parseKnown(['build']).opts as KnownOpts).config).toBe('/home/tester/default.yml')
  })
})

describe('parse_argv command and positional behavior', () => {
  it('extracts command and maps positional args in declaration order', () => {
    const parsed = parseKnown(['build', 'prod', 'a.ts', 'b.ts'])
    expect(parsed.commandName).toBe('build')
    const args = parsed.args as KnownArgs
    expect(args.target).toBe('prod')
    expect(args.files).toEqual(['a.ts', 'b.ts'])
  })

  it('reports unknown flags as parse errors', () => {
    const parsed = parseKnown(['build', '--nope', 'x', '--also-nope=y', 'prod'])
    expect(parsed.commandName).toBe('build')
    expect((parsed.args as KnownArgs).target).toBe('prod')
    expect(parsed.errors).toHaveLength(2)
    expect(parsed.errors[0]).toContain('Unknown option')
  })
})
