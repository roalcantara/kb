import { setup } from "./apps/kb"

const cli = setup()

if (import.meta.main) cli.run()