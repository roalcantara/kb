/** @jsxImportSource @opentui/solid */
import type { Component } from 'solid-js'

/** TUI root — kli passes `deps`, resolved global flags as `globals`, and `commandCount`. */
type ShellTuiProps = {
  deps: unknown
  globals: Record<string, unknown>
  commandCount: number
}

export const ShellTuiApp: Component<ShellTuiProps> = props => (
  <text>
    kb — {props.commandCount} commands
    {props.globals.verbose === true ? ' (verbose)' : ''} — press Ctrl+C to exit
  </text>
)
