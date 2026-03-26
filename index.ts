import { runCli } from '@shell'

function main() {
  const code = runCli(Bun.argv)
  if (code !== 0) process.exitCode = code
}

if (import.meta.main) main()
