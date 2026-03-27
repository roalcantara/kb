import { err, ok, type Result } from 'neverthrow'

import type { CommandDef, OptDef, OptsDef, ParseResult } from './parse_argv.ts'

const VARIADIC_SUFFIX = '...'
const VARIADIC_SUFFIX_SIZE = 3

type ScalarValue = string | number | boolean
type EnvMap = Record<string, string | undefined>

export type ResolvedCtxData = {
  args: ParseResult['args']
  opts: Record<string, ScalarValue>
  globals: Record<string, ScalarValue>
}

function coerceEnvValue(value: string, type: OptDef['type']): ScalarValue | undefined {
  if (type === 'string' || type === 'file') return value
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  const normalized = value.toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
}

function resolveOptionValue(
  optionName: string,
  def: OptDef,
  parsedOpts: Record<string, ScalarValue>,
  env: EnvMap
): ScalarValue | undefined {
  const direct = parsedOpts[optionName]
  if (direct !== undefined) return direct
  if (def.env) {
    const envValue = env[def.env]
    if (envValue !== undefined) return coerceEnvValue(envValue, def.type)
  }
  return def.default
}

function validateRequiredArgs(parsed: ParseResult, command: CommandDef, errors: string[]): void {
  for (const [rawArgName, def] of Object.entries(command.args ?? {})) {
    if (def.required === false) continue
    const isVariadic = rawArgName.endsWith(VARIADIC_SUFFIX)
    const argName = isVariadic ? rawArgName.slice(0, -VARIADIC_SUFFIX_SIZE) : rawArgName
    const argValue = parsed.args[argName]

    if (!isVariadic && argValue === undefined) {
      errors.push(`Missing required arg: ${argName}`)
      continue
    }

    if (isVariadic && (!Array.isArray(argValue) || argValue.length === 0)) {
      errors.push(`Missing required arg: ${argName}`)
    }
  }
}

function validateOptions(
  parsed: ParseResult,
  optionDefs: OptsDef,
  env: EnvMap,
  errors: string[]
): Record<string, ScalarValue> {
  const resolved: Record<string, ScalarValue> = {}

  for (const [optionName, def] of Object.entries(optionDefs)) {
    const value = resolveOptionValue(optionName, def, parsed.opts, env)

    if (def.required === true && value === undefined) {
      errors.push(`Missing required opt: ${optionName}`)
      continue
    }

    if (value === undefined) continue

    if (def.type === 'file' && typeof value === 'string' && value.trim().length === 0) {
      errors.push(`Invalid file opt: ${optionName}`)
      continue
    }

    resolved[optionName] = value
  }

  for (const [name, value] of Object.entries(parsed.opts)) {
    if (resolved[name] === undefined) resolved[name] = value
  }

  return resolved
}

export function validateCommand(
  parsed: ParseResult,
  command: CommandDef,
  globalOpts: OptsDef = {},
  env: EnvMap = Bun.env
): Result<ResolvedCtxData, string[]> {
  const errors = [...parsed.errors]
  validateRequiredArgs(parsed, command, errors)

  const mergedOptionDefs = { ...globalOpts, ...(command.opts ?? {}) }
  const resolvedOpts = validateOptions(parsed, mergedOptionDefs, env, errors)
  const resolvedGlobals: Record<string, ScalarValue> = {}

  for (const key of Object.keys(globalOpts)) {
    const value = resolvedOpts[key]
    if (value !== undefined) resolvedGlobals[key] = value
  }

  if (errors.length > 0) return err(errors)

  return ok({
    args: parsed.args,
    opts: resolvedOpts,
    globals: resolvedGlobals
  })
}
