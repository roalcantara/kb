import type { CliInstance } from './with_cli.ts'

export function withTui<CliT extends CliInstance>(cli: CliT, app: unknown): CliT {
  return {
    ...cli,
    tui: app
  }
}
