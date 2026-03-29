import type { CliInstance } from './cli_instance.factory.ts'

/**
 * Attaches an opaque TUI handle to a CLI instance (used when stdin is a TTY and no subcommand).
 *
 * @param cli - Existing {@link CliInstance}
 * @param app - Application-specific TUI root (framework-defined)
 * @returns Shallow copy of `cli` with `tui` set
 *
 * @example
 * const cli = withTui(baseCli, inkApp)
 */
export const withTui = <CliT extends CliInstance>(cli: CliT, app: unknown): CliT => ({
  ...cli,
  tui: app
})
