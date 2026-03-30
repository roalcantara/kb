import { describe, expect, it } from 'bun:test'
import { factory_for } from '@kli/tests'
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

const COMMANDS = factory_for('parseArgvCommands')

const env = (overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> => {
  const vars: Record<string, string | undefined> = { ...overrides }
  vars[HOME_KEY] = vars[HOME_KEY] ?? '/home/tester'
  return vars
}

const parseKnown = (tokens: string[], overrides?: Record<string, string | undefined>) =>
  parseArgv(factory_for('bunStyleArgv', ...tokens), {}, COMMANDS, env(overrides))

describe('parseArgv()', () => {
  describe('options', () => {
    const configCases = [
      { name: 'long flag with equals', tokens: ['build', '--config=/tmp/a.yml'] as const },
      { name: 'long flag and value', tokens: ['build', '--config', '/tmp/a.yml'] as const },
      { name: 'short flag and value', tokens: ['build', '-c', '/tmp/a.yml'] as const }
    ] as const

    for (const { name, tokens } of configCases) {
      it(`parses config (${name})`, () => {
        expect((parseKnown([...tokens]).opts as KnownOpts).config).toBe('/tmp/a.yml')
      })
    }

    it('coerces limit to number', () => {
      expect((parseKnown(['build', '--limit', '50']).opts as KnownOpts).limit).toBe(LIMIT_FIFTY)
    })

    it('sets verbose true from flag', () => {
      expect((parseKnown(['build', '--verbose']).opts as KnownOpts).verbose).toBe(true)
    })

    it('sets verbose false from negation', () => {
      expect((parseKnown(['build', '--no-verbose']).opts as KnownOpts).verbose).toBe(false)
    })

    const eitherCases = [
      { name: 'short p', tokens: ['build', '-p'] as const, want: 'pretty' },
      { name: 'long pretty', tokens: ['build', '--pretty'] as const, want: 'pretty' },
      { name: 'format json', tokens: ['build', '--format', 'json'] as const, want: 'json' }
    ] as const

    for (const { name, tokens, want } of eitherCases) {
      it(`maps either group (${name})`, () => {
        expect((parseKnown([...tokens]).opts as KnownOpts).format).toBe(want)
      })
    }

    describe('when either short flags conflict', () => {
      it('records one parse error', () => {
        const conflict = parseKnown(['build', '-p', '-j'])
        expect(conflict.errors).toHaveLength(1)
      })

      it('names either conflict', () => {
        const conflict = parseKnown(['build', '-p', '-j'])
        expect(conflict.errors[0]).toContain('Either conflict')
      })
    })
  })

  describe('fallback and expansion', () => {
    it('expands tilde and env in file opt', () => {
      const envWithRoot = env()
      envWithRoot[KLI_ROOT_KEY] = 'workspace'
      const opts = parseArgv(
        factory_for('bunStyleArgv', 'build', '--config', '~/cfg/$KLI_ROOT.yml'),
        {},
        COMMANDS,
        envWithRoot
      ).opts as KnownOpts
      expect(opts.config).toBe('/home/tester/cfg/workspace.yml')
    })

    it('uses KLI_CONFIG when flag absent', () => {
      const envWithConfig = env()
      envWithConfig[KLI_CONFIG_KEY] = '/env/config.yml'
      const opts = parseArgv(factory_for('bunStyleArgv', 'build'), {}, COMMANDS, envWithConfig).opts as KnownOpts
      expect(opts.config).toBe('/env/config.yml')
    })

    it('uses default path without env or flag', () => {
      expect((parseKnown(['build']).opts as KnownOpts).config).toBe('/home/tester/default.yml')
    })
  })

  describe('command and positionals', () => {
    it('extracts command name', () => {
      expect(parseKnown(['build', 'prod', 'a.ts', 'b.ts']).commandName).toBe('build')
    })

    it('maps positionals in order', () => {
      const args = parseKnown(['build', 'prod', 'a.ts', 'b.ts']).args as KnownArgs
      expect(args.target).toBe('prod')
      expect(args.files).toEqual(['a.ts', 'b.ts'])
    })

    describe('when argv has unknown flags', () => {
      it('keeps command and target', () => {
        const parsed = parseKnown(['build', '--nope', 'x', '--also-nope=y', 'prod'])
        expect(parsed.commandName).toBe('build')
        expect((parsed.args as KnownArgs).target).toBe('prod')
      })

      it('records two errors', () => {
        const parsed = parseKnown(['build', '--nope', 'x', '--also-nope=y', 'prod'])
        expect(parsed.errors).toHaveLength(2)
      })

      it('labels unknown options', () => {
        const parsed = parseKnown(['build', '--nope', 'x', '--also-nope=y', 'prod'])
        expect(parsed.errors[0]).toContain('Unknown option')
      })

      it('labels unknown short flags with the original token', () => {
        const parsed = parseKnown(['build', '-z', 'prod'])
        expect(parsed.errors[0]).toBe('Unknown option: -z')
      })
    })
  })
})
