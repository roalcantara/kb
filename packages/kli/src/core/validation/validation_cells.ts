import type {
  ArgDef,
  CommandDef,
  DefWithScalarDefault,
  EnvMap,
  OptDef,
  OptsDef,
  ParsedOptSource,
  ParseResult,
  ScalarValue
} from '../parsing/argv.schema.ts'
import { expandFileValue } from '../parsing/path_expand.util.ts'

const VARIADIC_SUFFIX = '...'
const VARIADIC_SUFFIX_SIZE = 3

/** Internal only: used while validating; `run` receives plain scalars. */
type InternalCell<T> = {
  value: T | undefined
  source: ParsedOptSource | 'unset'
  isPresent: boolean
}

type OptScalarMap = Record<string, ScalarValue | undefined>
type LocalOpts = Record<string, ScalarValue | undefined>
type GlobalsMap = Record<string, ScalarValue | undefined>

/**
 * Splits flat merged opts into command-local `opts` and CLI-wide `globals` using schema key sets.
 */
export const splitGlobalAndLocalOpts = (
  flat: Record<string, ScalarValue | undefined>,
  globalOpts: OptsDef,
  command: CommandDef
): { opts: LocalOpts; globals: GlobalsMap } => {
  const localKeys = new Set(Object.keys(command.opts ?? {}))
  const globals: GlobalsMap = {}
  for (const name of Object.keys(globalOpts)) {
    if (!localKeys.has(name)) globals[name] = flat[name]
  }
  const opts: LocalOpts = {}
  for (const name of localKeys) {
    opts[name] = flat[name]
  }
  return { opts, globals }
}

/** Coerces a string from the environment to the opt’s scalar type. */
const coerceEnvValue = (value: string, type: OptDef['type']): ScalarValue | undefined => {
  if (type === 'string' || type === 'file') return value
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  const normalized = value.toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
}

/** Resolves schema `default` for args/opts, expanding file paths when needed. */
const expandDefDefault = (def: DefWithScalarDefault, env: EnvMap): ScalarValue | undefined => {
  if (def.default === undefined) return
  if (def.type === 'file' && typeof def.default === 'string') return expandFileValue(def.default, env)
  return def.default
}

const expandOptDefault = (def: OptDef, env: EnvMap) => expandDefDefault(def, env)
const expandArgDefault = (def: ArgDef, env: EnvMap) => expandDefDefault(def, env)

/**
 * Resolves an option’s effective value from argv, env, or default (shape check helper).
 */
const resolveOptionValue = (
  optionName: string,
  def: OptDef,
  parsedOpts: Record<string, ScalarValue>,
  env: EnvMap
): ScalarValue | undefined => {
  const direct = parsedOpts[optionName]
  if (direct !== undefined) return direct
  if (def.env) {
    const envValue = env[def.env]
    if (envValue !== undefined) return coerceEnvValue(envValue, def.type)
  }
  if (def.default === undefined) return
  return expandOptDefault(def, env)
}

const optCellFromParsedValue = (
  optionName: string,
  def: OptDef,
  fromParsed: ScalarValue,
  source: ParsedOptSource,
  errors: string[]
): InternalCell<ScalarValue> | null => {
  if (def.type === 'file' && typeof fromParsed === 'string' && fromParsed.trim() === '') {
    errors.push(`Invalid file opt: ${optionName}`)
    return null
  }
  const isPresent = source === 'argv' || source === 'env'
  return { value: fromParsed, source, isPresent }
}

const resolveOptCell = (
  optionName: string,
  def: OptDef,
  parsedOpts: Record<string, ScalarValue>,
  optSources: Record<string, ParsedOptSource>,
  env: EnvMap,
  errors: string[]
): InternalCell<ScalarValue> | null => {
  const fromParsed = parsedOpts[optionName]
  const srcFromParse = optSources[optionName]
  if (fromParsed !== undefined && srcFromParse !== undefined) {
    return optCellFromParsedValue(optionName, def, fromParsed, srcFromParse, errors)
  }
  if (fromParsed !== undefined) {
    return optCellFromParsedValue(optionName, def, fromParsed, 'argv', errors)
  }
  if (def.env) {
    const envRaw = env[def.env]
    if (envRaw !== undefined) {
      const coerced = coerceEnvValue(envRaw, def.type)
      if (coerced !== undefined) {
        return { value: coerced, source: 'env', isPresent: true }
      }
    }
  }
  const defaultVal = expandOptDefault(def, env)
  if (defaultVal !== undefined) {
    return { value: defaultVal, source: 'default', isPresent: false }
  }
  if (def.required === true) {
    errors.push(`Missing required opt: ${optionName}`)
    return null
  }
  return { value: undefined, source: 'unset', isPresent: false }
}

const argCellWhenNoPositional = (
  argName: string,
  def: ArgDef,
  env: EnvMap,
  errors: string[],
  wrapDefault: (v: ScalarValue) => ScalarValue | ScalarValue[]
): InternalCell<ScalarValue | ScalarValue[]> | null => {
  const dv = expandArgDefault(def, env)
  if (dv !== undefined) {
    return { value: wrapDefault(dv), source: 'default', isPresent: false }
  }
  if (def.required === false) {
    return { value: undefined, source: 'unset', isPresent: false }
  }
  errors.push(`Missing required arg: ${argName}`)
  return null
}

const variadicArgValues = (rawVal: ScalarValue | ScalarValue[] | undefined): ScalarValue[] => {
  if (Array.isArray(rawVal)) return rawVal as ScalarValue[]
  if (rawVal === undefined) return []
  return [rawVal as ScalarValue]
}

const addArgCellForEntry = (
  parsed: ParseResult,
  rawKey: string,
  def: ArgDef,
  env: EnvMap,
  errors: string[],
  out: Record<string, InternalCell<ScalarValue | ScalarValue[]>>
): void => {
  const variadic = rawKey.endsWith(VARIADIC_SUFFIX)
  const argName = variadic ? rawKey.slice(0, -VARIADIC_SUFFIX_SIZE) : rawKey
  const rawVal = parsed.args[argName]

  if (variadic) {
    const arr = variadicArgValues(rawVal)
    if (arr.length > 0) {
      out[argName] = { value: arr, source: 'argv', isPresent: true }
      return
    }
    const cell = argCellWhenNoPositional(argName, def, env, errors, v => [v])
    if (cell !== null) out[argName] = cell
    return
  }
  if (rawVal === undefined) {
    const cell = argCellWhenNoPositional(argName, def, env, errors, v => v)
    if (cell !== null) out[argName] = cell
    return
  }
  out[argName] = { value: rawVal as ScalarValue, source: 'argv', isPresent: true }
}

export const buildArgCells = (
  parsed: ParseResult,
  command: CommandDef,
  env: EnvMap,
  errors: string[]
): Record<string, InternalCell<ScalarValue | ScalarValue[]>> => {
  const out: Record<string, InternalCell<ScalarValue | ScalarValue[]>> = {}
  for (const [rawKey, def] of Object.entries(command.args ?? {})) {
    addArgCellForEntry(parsed, rawKey, def, env, errors, out)
  }
  return out
}

export const buildOptCells = (
  parsed: ParseResult,
  mergedOptionDefs: OptsDef,
  env: EnvMap,
  errors: string[]
): Record<string, InternalCell<ScalarValue>> => {
  const optSources = parsed.optSources
  const out: Record<string, InternalCell<ScalarValue>> = {}
  for (const [optionName, def] of Object.entries(mergedOptionDefs)) {
    const cell = resolveOptCell(optionName, def, parsed.opts, optSources, env, errors)
    if (cell !== null) out[optionName] = cell
  }
  for (const [name, value] of Object.entries(parsed.opts)) {
    if (out[name] === undefined) {
      const src = optSources[name] ?? 'argv'
      const isPresent = src === 'argv' || src === 'env'
      out[name] = { value, source: src, isPresent }
    }
  }
  return out
}

const cellToScalar = <T extends ScalarValue | ScalarValue[]>(c: InternalCell<T> | undefined): T | undefined => {
  if (!c || c.source === 'unset') return
  return c.value as T | undefined
}

export const flattenArgScalars = (
  command: CommandDef,
  cells: Record<string, InternalCell<ScalarValue | ScalarValue[]>>
): Record<string, ScalarValue | ScalarValue[] | undefined> => {
  const out: Record<string, ScalarValue | ScalarValue[] | undefined> = {}
  for (const rawKey of Object.keys(command.args ?? {})) {
    const argName = rawKey.endsWith(VARIADIC_SUFFIX) ? rawKey.slice(0, -VARIADIC_SUFFIX_SIZE) : rawKey
    out[argName] = cellToScalar(cells[argName])
  }
  return out
}

export const flattenOptScalars = (
  mergedOptionDefs: OptsDef,
  cells: Record<string, InternalCell<ScalarValue>>
): OptScalarMap => {
  const out: OptScalarMap = {}
  for (const name of Object.keys(mergedOptionDefs)) {
    out[name] = cellToScalar(cells[name])
  }
  return out
}

export const validateMergedOptsShape = (
  parsed: ParseResult,
  mergedOptionDefs: OptsDef,
  env: EnvMap,
  errors: string[]
): void => {
  for (const [optionName, def] of Object.entries(mergedOptionDefs)) {
    const value = resolveOptionValue(optionName, def, parsed.opts, env)
    if (def.required === true && value === undefined) {
      errors.push(`Missing required opt: ${optionName}`)
      continue
    }
    if (value === undefined) continue
    if (def.type === 'file' && typeof value === 'string' && value.trim().length === 0) {
      errors.push(`Invalid file opt: ${optionName}`)
    }
  }
}
