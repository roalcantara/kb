/** Run the CLI process (used by `index.headless.ts`; `import.meta.main` is unreliable in `--compile` binaries). */
export function runCliEntry(runCli: (argv: string[]) => Promise<number>): void {
  ;(async () => {
    const code = await runCli(Bun.argv)
    if (code !== 0) process.exitCode = code
  })().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

/** Dev entry (`index.ts`): only auto-run when executed as the script entry, not when imported. */
export function runCliMain(runCli: (argv: string[]) => Promise<number>): void {
  if (import.meta.main) {
    runCliEntry(runCli)
  }
}
