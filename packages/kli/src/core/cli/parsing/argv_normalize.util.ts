const PATH_SEPARATOR = /[/\\]/

/**
 * Strips the runtime / script prefix from `rawArgv` so parsing starts at user tokens.
 */
export const normalizeArgv = (raw: readonly string[]): string[] => {
  const args = raw.slice(2)
  const scriptName = raw[1]?.split(PATH_SEPARATOR).pop()
  let i = 0
  while (scriptName && args[i] === scriptName) i += 1
  return args.slice(i)
}
