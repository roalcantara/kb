/** Solid / OpenTUI root component type (no OpenTUI imports — safe for bundler graph). */
export type TuiRootProps = {
  deps: unknown
  globals: Record<string, unknown>
  commandCount: number
}

/** Mounted when `CliInstance.tui` is set (Solid / OpenTUI root). */
export type TuiRoot = (props: TuiRootProps) => unknown
