/** Run the CLI process (used by `main.cli.headless.ts`; `import.meta.main` is unreliable in `--compile` binaries). */
export function runCliEntry(runCli: (argv: string[]) => Promise<number>): void {
  ;(async () => {
    const code = await runCli(Bun.argv)
    if (code !== 0) process.exitCode = code
  })().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

/**
 * Dev entry (`shell/index.ts`): only auto-run when the **entry** file is executed, not when imported.
 * Pass `import.meta.main` from that entry file — `import.meta.main` here would refer to this module and is always false.
 */
export function runCliMain(runCli: (argv: string[]) => Promise<number>, isEntry: boolean): void {
  if (isEntry) {
    runCliEntry(runCli)
  }
}
