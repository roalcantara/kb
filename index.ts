import { setup } from './apps/kb'
import pkg from './apps/kb/package.json'

const cli = setup(pkg)

if (import.meta.main) cli.run()
