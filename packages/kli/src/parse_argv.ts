import { sift } from 'radash'

import { normalizeArgv } from './minimal_cli.ts'

const LONG_PREFIX_SIZE = 2
const SHORT_PREFIX_SIZE = 1
const NEGATED_PREFIX = 'no-'
const NEGATED_PREFIX_SIZE = 3
const VARIADIC_SUFFIX = '...'
const VARIADIC_SUFFIX_SIZE = 3
const HOME_KEY = 'HOME'

type ScalarType = 'string' | 'number' | 'boolean' | 'file'
type ScalarValue = string | number | boolean
type EnvMap = Record<string, string | undefined>

export type ArgDef = { type: ScalarType; required?: boolean }
export type ArgsDef = Record<string, ArgDef>
export type EitherDef = Record<string, string>
export type OptDef = {
  type: ScalarType
  required?: boolean
  short?: string
  env?: string
  default?: ScalarValue
  either?: EitherDef
}
export type OptsDef = Record<string, OptDef>
export type CommandDef = { name: string; args?: ArgsDef; opts?: OptsDef }

export type ParseResult = {
  commandName?: string
  opts: Record<string, ScalarValue>
  args: Record<string, ScalarValue | ScalarValue[]>
  positional: string[]
  errors: string[]
}

type ParseState = {
  opts: Record<string, ScalarValue>
  positional: string[]
  errors: string[]
  eitherSelections: Record<string, string>
}

function expandFileValue(value: string, env: EnvMap): string {
  const home = env[HOME_KEY] ?? ''
  const homeExpanded =
    value === '~' ? home : value.startsWith('~/') ? `${home}/${value.slice(LONG_PREFIX_SIZE)}` : value
  return homeExpanded.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_full, envName: string) => env[envName] ?? '')
}

function coerceValue(raw: string | undefined, type: ScalarType, env: EnvMap): ScalarValue | undefined {
  if (raw === undefined) return type === 'boolean' ? true : undefined
  if (type === 'string') return raw
  if (type === 'file') return expandFileValue(raw, env)
  if (type === 'number') {
    const num = Number(raw)
    return Number.isNaN(num) ? undefined : num
  }
  const normalized = raw.toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
}

function pickCommand(tokens: string[], commands: readonly CommandDef[]): { commandName?: string; rest: string[] } {
  const commandToken = tokens.find(token => !token.startsWith('-'))
  if (!commandToken) return { rest: tokens }
  const command = commands.find(c => c.name === commandToken)
  if (!command) return { rest: tokens }
  const idx = tokens.indexOf(commandToken)
  return { commandName: commandToken, rest: [...tokens.slice(0, idx), ...tokens.slice(idx + 1)] }
}

function findOptionByEitherShort(options: OptsDef, short: string): [string, OptDef] | undefined {
  return Object.entries(options).find(([, def]) => def.either?.[short] !== undefined)
}

function findOptionByEitherLong(options: OptsDef, long: string): [string, OptDef] | undefined {
  return Object.entries(options).find(([, def]) => Object.values(def.either ?? {}).includes(long))
}

function consumeUnknownOption(tokens: string[], idx: number, token: string, errors: string[]): number {
  const option = token.startsWith('--') ? token.slice(LONG_PREFIX_SIZE).split('=')[0] : token.slice(SHORT_PREFIX_SIZE)
  errors.push(`Unknown option: ${option ? `--${option}` : token}`)
  if (token.includes('=')) return idx
  const next = tokens[idx + 1]
  return next && !next.startsWith('-') ? idx + 1 : idx
}

function writeEitherSelection(state: ParseState, key: string, selected: string): void {
  const previous = state.eitherSelections[key]
  if (previous && previous !== selected) {
    state.errors.push(`Either conflict for "${key}": "${previous}" and "${selected}"`)
    return
  }
  state.eitherSelections[key] = selected
  state.opts[key] = selected
}

function readInlineValue(body: string): { name: string; value?: string } {
  const eqAt = body.indexOf('=')
  if (eqAt === -1) return { name: body }
  return { name: body.slice(0, eqAt), value: body.slice(eqAt + 1) }
}

function writeDirectLongOption(
  idx: number,
  parsed: { name: string; value?: string },
  negated: boolean,
  directOpt: OptDef,
  tokens: string[],
  state: ParseState,
  env: EnvMap
): number {
  const next = tokens[idx + 1]
  const valueToken = parsed.value ?? (directOpt.type === 'boolean' || next?.startsWith('-') ? undefined : next)
  const consumed = parsed.value === undefined && directOpt.type !== 'boolean' && valueToken !== undefined

  if (negated && directOpt.type === 'boolean') {
    state.opts[parsed.name] = false
    return consumed ? idx + 1 : idx
  }

  const coerced = coerceValue(valueToken, directOpt.type, env)
  if (coerced !== undefined) state.opts[parsed.name] = coerced
  return consumed ? idx + 1 : idx
}

function parseLongToken(tokens: string[], idx: number, options: OptsDef, state: ParseState, env: EnvMap): number {
  const current = tokens[idx]
  if (current === undefined) return idx
  const raw = current.slice(LONG_PREFIX_SIZE)
  const negated = raw.startsWith(NEGATED_PREFIX)
  const body = negated ? raw.slice(NEGATED_PREFIX_SIZE) : raw
  const parsed = readInlineValue(body)
  const directOpt = options[parsed.name]
  const eitherLong = directOpt ? undefined : findOptionByEitherLong(options, parsed.name)

  if (!directOpt && !eitherLong) return consumeUnknownOption(tokens, idx, current, state.errors)
  if (eitherLong) {
    writeEitherSelection(state, eitherLong[0], parsed.name)
    return idx
  }
  if (!directOpt) return idx
  return writeDirectLongOption(idx, parsed, negated, directOpt, tokens, state, env)
}

function parseShortToken(tokens: string[], idx: number, options: OptsDef, state: ParseState, env: EnvMap): number {
  const current = tokens[idx]
  if (current === undefined) return idx
  const parsed = readInlineValue(current.slice(SHORT_PREFIX_SIZE))
  const direct = Object.entries(options).find(([, optionDef]) => optionDef.short === parsed.name)
  const eitherShort = direct ? undefined : findOptionByEitherShort(options, parsed.name)

  if (!direct && !eitherShort) return consumeUnknownOption(tokens, idx, current, state.errors)
  if (eitherShort) {
    const selected = eitherShort[1].either?.[parsed.name]
    if (selected) writeEitherSelection(state, eitherShort[0], selected)
    return idx
  }
  if (!direct) return idx

  const [key, def] = direct
  const next = tokens[idx + 1]
  const valueToken = parsed.value ?? (def.type === 'boolean' || next?.startsWith('-') ? undefined : next)
  const consumed = parsed.value === undefined && def.type !== 'boolean' && valueToken !== undefined
  const coerced = coerceValue(valueToken, def.type, env)
  if (coerced !== undefined) state.opts[key] = coerced
  return consumed ? idx + 1 : idx
}

function parseTokens(tokens: string[], options: OptsDef, env: EnvMap): ParseState {
  const state: ParseState = { opts: {}, positional: [], errors: [], eitherSelections: {} }
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token === undefined) continue
    if (token === '-' || !token.startsWith('-')) {
      state.positional.push(token)
      continue
    }
    if (token === '--') {
      state.positional.push(...tokens.slice(i + 1))
      break
    }
    i = token.startsWith('--')
      ? parseLongToken(tokens, i, options, state, env)
      : parseShortToken(tokens, i, options, state, env)
  }
  return state
}

function applyFallbacks(opts: Record<string, ScalarValue>, options: OptsDef, env: EnvMap): void {
  for (const [key, def] of Object.entries(options)) {
    if (opts[key] !== undefined) continue
    if (def.env && env[def.env] !== undefined) {
      const envValue = coerceValue(env[def.env], def.type, env)
      if (envValue !== undefined) {
        opts[key] = envValue
        continue
      }
    }
    if (def.default !== undefined) {
      opts[key] =
        def.type === 'file' && typeof def.default === 'string' ? expandFileValue(def.default, env) : def.default
    }
  }
}

function parseNamedArgs(
  argDefs: ArgsDef,
  positional: string[],
  env: EnvMap
): Record<string, ScalarValue | ScalarValue[]> {
  const args: Record<string, ScalarValue | ScalarValue[]> = {}
  let cursor = 0
  for (const [rawKey, def] of Object.entries(argDefs)) {
    const variadic = rawKey.endsWith(VARIADIC_SUFFIX)
    const key = variadic ? rawKey.slice(0, -VARIADIC_SUFFIX_SIZE) : rawKey
    if (variadic) {
      args[key] = sift(positional.slice(cursor).map(item => coerceValue(item, def.type, env)))
      cursor = positional.length
      continue
    }
    const coerced = coerceValue(positional[cursor], def.type, env)
    if (coerced !== undefined) args[key] = coerced
    cursor += 1
  }
  return args
}

export function parseArgv(
  rawArgv: readonly string[],
  globalOpts: OptsDef = {},
  commands: readonly CommandDef[] = [],
  env: EnvMap = Bun.env
): ParseResult {
  const tokens = normalizeArgv(rawArgv)
  const commandPick = pickCommand(tokens, commands)
  const command = commands.find(c => c.name === commandPick.commandName)
  const options = { ...globalOpts, ...(command?.opts ?? {}) }
  const state = parseTokens(commandPick.rest, options, env)
  applyFallbacks(state.opts, options, env)
  const args = parseNamedArgs(command?.args ?? {}, state.positional, env)

  return commandPick.commandName === undefined
    ? { opts: state.opts, args, positional: state.positional, errors: state.errors }
    : {
        commandName: commandPick.commandName,
        opts: state.opts,
        args,
        positional: state.positional,
        errors: state.errors
      }
}
