export type ScalarValue = string | number | boolean
export type EnvMap = Record<string, string | undefined>
export type ScalarType = 'string' | 'number' | 'boolean' | 'file'
export type ArgDef = { type: ScalarType; required?: boolean; default?: ScalarValue }
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
/** Where a merged opt value came from (token parse vs env vs default fill). */
export type ParsedOptSource = 'argv' | 'env' | 'default'

export type ParseResultBase = {
  opts: Record<string, ScalarValue>
  /** Parallel to `opts` for keys set during parse + applyFallbacks. */
  optSources: Record<string, ParsedOptSource>
  positional: string[]
  errors: string[]
}

export type ParseResult = ParseResultBase & {
  commandName?: string
  args: Record<string, ScalarValue | ScalarValue[]>
}

export type ParseState = ParseResultBase & {
  eitherSelections: Record<string, string>
}

export type DefWithScalarDefault = Pick<ArgDef, 'default' | 'type'>
