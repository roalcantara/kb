import { runCli } from '@shell'

async function main() {
  const code = await runCli(Bun.argv)
  if (code !== 0) process.exitCode = code
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
