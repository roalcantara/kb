/** First argv token that is not a flag (detect unknown subcommands). */
export const firstNonFlag = (args: readonly string[]): string | undefined => args.find(arg => !arg.startsWith('-'))
