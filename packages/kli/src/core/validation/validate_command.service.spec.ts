import { describe, expect, test } from 'bun:test'

import type { CommandDef, OptsDef } from '../parsing/argv.schema.ts'
import { parseArgv } from '../parsing/argv_parse.service.ts'
import { validateCommand } from './validate_command.service.ts'

const COMMAND: CommandDef = {
  name: 'build',
  args: {
    target: { type: 'string' }
  },
  opts: {
    config: { type: 'file', short: 'c', required: true },
    format: {
      type: 'string',
      either: { p: 'pretty', j: 'json' }
    }
  }
}

/** Synthetic argv prefix + tokens for {@link parseArgv} tests. */
const argv = (...tokens: string[]): string[] => ['/bun', 'index.ts', ...tokens]

describe('validate_command / basics', () => {
  test('returns ok when required args and opts are present', () => {
    const parsed = parseArgv(argv('build', 'prod', '--config', '/tmp/a.yml'), {}, [COMMAND], {})
    const result = validateCommand(parsed, COMMAND, {}, {})
    expect(result.isOk()).toBe(true)
  })

  test('returns error when required arg is missing', () => {
    const parsed = parseArgv(argv('build', '--config', '/tmp/a.yml'), {}, [COMMAND], {})
    const result = validateCommand(parsed, COMMAND, {}, {})
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().join('\n')).toContain('Missing required arg: target')
  })

  test('returns error when required opt is missing and has no env/default', () => {
    const parsed = parseArgv(argv('build', 'prod'), {}, [COMMAND], {})
    const result = validateCommand(parsed, COMMAND, {}, {})
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().join('\n')).toContain('Missing required opt: config')
  })

  test('reports either conflict from parse stage', () => {
    const parsed = parseArgv(argv('build', 'prod', '--config', '/tmp/a.yml', '-p', '-j'), {}, [COMMAND], {})
    const result = validateCommand(parsed, COMMAND, {}, {})
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().join('\n')).toContain('Either conflict')
  })

  test('collects multiple errors at once', () => {
    const parsed = parseArgv(argv('build'), {}, [COMMAND], {})
    const result = validateCommand(parsed, COMMAND, {}, {})
    expect(result.isErr()).toBe(true)
    const joined = result._unsafeUnwrapErr().join('\n')
    expect(joined).toContain('Missing required arg: target')
    expect(joined).toContain('Missing required opt: config')
  })
})

describe('validate_command / merge and scalars', () => {
  test('global and local opts merge with local precedence', () => {
    const globalOpts: OptsDef = {
      format: { type: 'number', default: 10 }
    }
    const localCommand: CommandDef = {
      ...COMMAND,
      opts: {
        ...COMMAND.opts,
        format: { type: 'string', default: 'json' }
      }
    }
    const parsed = parseArgv(argv('build', 'prod', '--config', '/tmp/a.yml'), globalOpts, [localCommand], {})
    const result = validateCommand(parsed, localCommand, globalOpts, {})
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().opts['format']).toBe('json')
  })

  test('returns fully merged ctx data when valid', () => {
    const globalOpts: OptsDef = {
      region: { type: 'string', default: 'eu-west-1' }
    }
    const parsed = parseArgv(argv('build', 'prod', '--config', '/tmp/a.yml'), globalOpts, [COMMAND], {})
    const result = validateCommand(parsed, COMMAND, globalOpts, {})
    expect(result.isOk()).toBe(true)
    const data = result._unsafeUnwrap()
    expect(data.args['target']).toBe('prod')
    expect(data.globals['region']).toBe('eu-west-1')
    expect(data.opts['config']).toBe('/tmp/a.yml')
  })

  test('resolves opt from env when argv absent', () => {
    const command: CommandDef = {
      name: 'x',
      opts: { apiKey: { type: 'string', env: 'KLI_TEST_API', required: true } }
    }
    const parsed = parseArgv(argv('x'), {}, [command], {})
    const kliTestApiEnvKey = 'KLI_TEST_API'
    const testEnv: Record<string, string | undefined> = { [kliTestApiEnvKey]: 'secret' }
    const result = validateCommand(parsed, command, {}, testEnv)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().opts['apiKey']).toBe('secret')
  })
})
