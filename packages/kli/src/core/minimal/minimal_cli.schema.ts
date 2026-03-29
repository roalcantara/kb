export type CliCommandDefinition = {
  /** First argv token that selects this command */
  name: string
  /** Single line in the Commands section (leading spaces added by the formatter) */
  helpLine: string
  /** Positional args after the command name */
  run: (positionalArgs: readonly string[]) => void
}

export type MinimalCliConfig = {
  /** Shown in Usage, e.g. binary or script name */
  programName: string
  description: string
  version: string
  commands: readonly CliCommandDefinition[]
}
