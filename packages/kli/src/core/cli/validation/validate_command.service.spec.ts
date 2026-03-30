import { describe, expect, it } from 'bun:test'

import { factory_for } from '@kli/tests'
import { parseArgv } from '../parsing/index.ts'
import { validateCommand } from './validate_command.service.ts'

const primaryCommand = factory_for('validateCommandPrimaryCommand')

describe('validateCommand()', () => {
  describe('when argv has target and config', () => {
    it('validates the command', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'full'), {}, [primaryCommand], {})
      expect(validateCommand(parsed, primaryCommand, {}, {}).isOk()).toBe(true)
    })
  })

  describe('when target arg is missing', () => {
    it('does not validate the command', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'noTarget'), {}, [primaryCommand], {})
      expect(validateCommand(parsed, primaryCommand, {}, {}).isErr()).toBe(true)
    })

    it('reports missing target', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'noTarget'), {}, [primaryCommand], {})
      const err = validateCommand(parsed, primaryCommand, {}, {})._unsafeUnwrapErr().join('\n')
      expect(err).toContain('Missing required arg: target')
    })
  })

  describe('when config opt is missing', () => {
    it('does not validate the command', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'noConfig'), {}, [primaryCommand], {})
      expect(validateCommand(parsed, primaryCommand, {}, {}).isErr()).toBe(true)
    })

    it('reports missing config', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'noConfig'), {}, [primaryCommand], {})
      const err = validateCommand(parsed, primaryCommand, {}, {})._unsafeUnwrapErr().join('\n')
      expect(err).toContain('Missing required opt: config')
    })
  })

  describe('when either-group flags clash', () => {
    it('does not validate the command', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'eitherClash'), {}, [primaryCommand], {})
      expect(validateCommand(parsed, primaryCommand, {}, {}).isErr()).toBe(true)
    })

    it('reports either conflict', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'eitherClash'), {}, [primaryCommand], {})
      const err = validateCommand(parsed, primaryCommand, {}, {})._unsafeUnwrapErr().join('\n')
      expect(err).toContain('Either conflict')
    })
  })

  describe('when target and config both missing', () => {
    it('does not validate the command', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'emptyTail'), {}, [primaryCommand], {})
      expect(validateCommand(parsed, primaryCommand, {}, {}).isErr()).toBe(true)
    })

    it('reports missing target', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'emptyTail'), {}, [primaryCommand], {})
      const joined = validateCommand(parsed, primaryCommand, {}, {})._unsafeUnwrapErr().join('\n')
      expect(joined).toContain('Missing required arg: target')
    })

    it('reports missing config', () => {
      const parsed = parseArgv(factory_for('validateCommandArgv', 'emptyTail'), {}, [primaryCommand], {})
      const joined = validateCommand(parsed, primaryCommand, {}, {})._unsafeUnwrapErr().join('\n')
      expect(joined).toContain('Missing required opt: config')
    })
  })

  describe('when global and local opts overlap', () => {
    it('prefers local format', () => {
      const globalOpts = factory_for('validateCommandMergeGlobalOpts')
      const localCommand = factory_for('validateCommandMergeLocalCommand')
      const parsed = parseArgv(factory_for('validateCommandArgv', 'full'), globalOpts, [localCommand], {})
      const result = validateCommand(parsed, localCommand, globalOpts, {})
      expect(result._unsafeUnwrap().opts['format']).toBe('json')
    })
  })

  describe('when globals define region', () => {
    it('merges args opts and globals', () => {
      const globalOpts = factory_for('validateCommandRegionGlobalOpts')
      const parsed = parseArgv(factory_for('validateCommandArgv', 'full'), globalOpts, [primaryCommand], {})
      const data = validateCommand(parsed, primaryCommand, globalOpts, {})._unsafeUnwrap()
      expect(data.args['target']).toBe('prod')
      expect(data.globals['region']).toBe('eu-west-1')
      expect(data.opts['config']).toBe('/tmp/a.yml')
    })
  })

  describe('when opt is only in env', () => {
    it('resolves apiKey from env', () => {
      const command = factory_for('validateCommandApiKeyCommand')
      const testEnv = factory_for('validateCommandApiKeyEnv')
      const parsed = parseArgv(factory_for('validateCommandArgv', 'xOnly'), {}, [command], {})
      const result = validateCommand(parsed, command, {}, testEnv)
      expect(result._unsafeUnwrap().opts['apiKey']).toBe('secret')
    })
  })
})
