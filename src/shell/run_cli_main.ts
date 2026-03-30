/** Shared `import.meta.main` bootstrap for shell entrypoints. */
export function runCliMain(runCli: (argv: string[]) => Promise<number>): void {
  if (import.meta.main) {
    ;(async () => {
      const code = await runCli(Bun.argv)
      if (code !== 0) process.exitCode = code
    })().catch(error => {
      console.error(error)
      process.exitCode = 1
    })
  }
}
