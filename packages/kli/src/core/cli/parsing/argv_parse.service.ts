import { sift } from 'radash'
import type {
  ArgsDef,
  CommandDef,
  EnvMap,
  OptDef,
  OptsDef,
  ParseResult,
  ParseState,
  ScalarType,
  ScalarValue
} from './argv.schema.ts'
import { normalizeArgv } from './argv_normalize.util.ts'
import { expandFileValue } from './path_expand.util.ts'

const LONG_PREFIX_SIZE = 2
const SHORT_PREFIX_SIZE = 1
const NEGATED_PREFIX = 'no-'
const NEGATED_PREFIX_SIZE = 3
const VARIADIC_SUFFIX = '...'
const VARIADIC_SUFFIX_SIZE = 3

/**
 * Coerces a raw CLI token to a scalar matching the schema type.
 *
 * @param raw - Token text, or `undefined` (boolean flags default to `true` when absent)
 * @param type - Schema type for the arg or opt
 * @param env - Used when `type` is `file` (see {@link expandFileValue})
 * @returns Coerced value, or `undefined` if invalid / missing
 */
const coerceValue = (raw: string | undefined, type: ScalarType, env: EnvMap): ScalarValue | undefined => {
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

/**
 * Finds the first positional token that names a known command and returns it with that token removed from the stream.
 *
 * @param tokens - Normalized argv tokens (after {@link normalizeArgv})
 * @param commands - Registered command definitions (names compared to first non-flag token)
 * @returns `commandName` when matched, plus `rest` tokens with the command name removed once
 */
const pickCommand = (tokens: string[], commands: readonly CommandDef[]): { commandName?: string; rest: string[] } => {
  const commandToken = tokens.find(token => !token.startsWith('-'))
  if (!commandToken) return { rest: tokens }
  const command = commands.find(c => c.name === commandToken)
  if (!command) return { rest: tokens }
  const idx = tokens.indexOf(commandToken)
  return { commandName: commandToken, rest: [...tokens.slice(0, idx), ...tokens.slice(idx + 1)] }
}

/** Looks up an option whose `either` map maps this short flag letter to a long name. */
const findOptionByEitherShort = (options: OptsDef, short: string): [string, OptDef] | undefined =>
  Object.entries(options).find(([, def]) => def.either?.[short] !== undefined)

/** Looks up an option whose `either` map includes this long flag name as a value. */
const findOptionByEitherLong = (options: OptsDef, long: string): [string, OptDef] | undefined =>
  Object.entries(options).find(([, def]) => Object.values(def.either ?? {}).includes(long))

/**
 * Records an unknown flag error and returns the next token index to continue from (skips value if consumed).
 *
 * @returns New index into `tokens` after handling this option token
 */
const consumeUnknownOption = (tokens: string[], idx: number, token: string, errors: string[]): number => {
  const label = token.startsWith('--') ? token.split('=')[0] : token
  errors.push(`Unknown option: ${label}`)
  if (token.includes('=')) return idx
  const next = tokens[idx + 1]
  return next && !next.startsWith('-') ? idx + 1 : idx
}

/** Records a mutually exclusive group selection, or pushes an error if two different members were chosen. */
const writeEitherSelection = (state: ParseState, key: string, selected: string): void => {
  const previous = state.eitherSelections[key]
  if (previous && previous !== selected) {
    state.errors.push(`Either conflict for "${key}": "${previous}" and "${selected}"`)
    return
  }
  state.eitherSelections[key] = selected
  state.opts[key] = selected
  state.optSources[key] = 'argv'
}

/** Parses `--name` or `--name=value` style long-option bodies (without the leading `--`). */
const readInlineValue = (body: string): { name: string; value?: string } => {
  const eqAt = body.indexOf('=')
  if (eqAt === -1) return { name: body }
  return { name: body.slice(0, eqAt), value: body.slice(eqAt + 1) }
}

/**
 * Applies a single long option token to parse state; returns the next index to use in `tokens`.
 *
 * @returns Updated `idx` after consuming optional separate value token
 */
const writeDirectLongOption = (
  idx: number,
  parsed: { name: string; value?: string },
  negated: boolean,
  directOpt: OptDef,
  tokens: string[],
  state: ParseState,
  env: EnvMap
): number => {
  const next = tokens[idx + 1]
  const valueToken = parsed.value ?? (directOpt.type === 'boolean' || next?.startsWith('-') ? undefined : next)
  const consumed = parsed.value === undefined && directOpt.type !== 'boolean' && valueToken !== undefined

  if (negated && directOpt.type === 'boolean') {
    state.opts[parsed.name] = false
    state.optSources[parsed.name] = 'argv'
    return consumed ? idx + 1 : idx
  }

  const coerced = coerceValue(valueToken, directOpt.type, env)
  if (coerced !== undefined) {
    state.opts[parsed.name] = coerced
    state.optSources[parsed.name] = 'argv'
  }
  return consumed ? idx + 1 : idx
}

/**
 * Consumes one `--long` or `--no-long` token and updates `state`.
 *
 * @returns Next index into `tokens` (same or advanced if a value was eaten)
 */
const parseLongToken = (tokens: string[], idx: number, options: OptsDef, state: ParseState, env: EnvMap): number => {
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

/**
 * Consumes one short option token: `-x`, `-x=value`, or `-x` with value on the next token
 * for non-boolean options. Does not implement POSIX short-flag clustering (`-abc` as multiple
 * flags).
 *
 * @returns Next index into `tokens`
 */
const parseShortToken = (tokens: string[], idx: number, options: OptsDef, state: ParseState, env: EnvMap): number => {
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
  if (coerced !== undefined) {
    state.opts[key] = coerced
    state.optSources[key] = 'argv'
  }
  return consumed ? idx + 1 : idx
}

/** Walks all tokens after the command name: flags into `opts`, remainder into `positional`. */
const parseTokens = (tokens: string[], options: OptsDef, env: EnvMap): ParseState => {
  const state: ParseState = { opts: {}, optSources: {}, positional: [], errors: [], eitherSelections: {} }
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

/** Fills missing options from `def.env` and `def.default` after argv parse. */
const applyFallbacks = (state: ParseState, options: OptsDef, env: EnvMap): void => {
  for (const [key, def] of Object.entries(options)) {
    if (state.opts[key] !== undefined) continue
    if (def.env && env[def.env] !== undefined) {
      const envValue = coerceValue(env[def.env], def.type, env)
      if (envValue !== undefined) {
        state.opts[key] = envValue
        state.optSources[key] = 'env'
        continue
      }
    }
    if (def.default !== undefined) {
      state.opts[key] =
        def.type === 'file' && typeof def.default === 'string' ? expandFileValue(def.default, env) : def.default
      state.optSources[key] = 'default'
    }
  }
}

/**
 * Maps positional tokens to named args using `argDefs` order; supports `key...` variadic keys.
 *
 * @returns Arg map keyed by logical name (variadic base name without `...`)
 */
const parseNamedArgs = (
  argDefs: ArgsDef,
  positional: string[],
  env: EnvMap
): Record<string, ScalarValue | ScalarValue[]> => {
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

/**
 * Parses `rawArgv` into opts, positional args, optional `commandName`, and parse errors.
 *
 * @param rawArgv - Full process argv (e.g. `Bun.argv`)
 * @param globalOpts - CLI-wide option definitions merged with the active command’s opts
 * @param commands - Command list (names, per-command `args` / `opts`)
 * @param env - Environment for `env:` keys and file expansion (defaults to `Bun.env`)
 * @returns Structured parse result; validation is {@link validateCommand}
 *
 * @example
 * parseArgv(['bun', 'app.ts', 'build', '--verbose'], { verbose: { type: 'boolean' } }, [
 *   { name: 'build', args: { target: { type: 'string' } } }
 * ])
 */
export const parseArgv = (
  rawArgv: readonly string[],
  globalOpts: OptsDef = {},
  commands: readonly CommandDef[] = [],
  env: EnvMap = Bun.env
): ParseResult => {
  const tokens = normalizeArgv(rawArgv)
  const commandPick = pickCommand(tokens, commands)
  const command = commands.find(c => c.name === commandPick.commandName)
  const options = { ...globalOpts, ...(command?.opts ?? {}) }
  const state = parseTokens(commandPick.rest, options, env)
  applyFallbacks(state, options, env)
  const args = parseNamedArgs(command?.args ?? {}, state.positional, env)

  return commandPick.commandName === undefined
    ? {
        opts: state.opts,
        optSources: state.optSources,
        args,
        positional: state.positional,
        errors: state.errors
      }
    : {
        commandName: commandPick.commandName,
        opts: state.opts,
        optSources: state.optSources,
        args,
        positional: state.positional,
        errors: state.errors
      }
}
