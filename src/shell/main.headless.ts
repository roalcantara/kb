import { createKliHeadless } from '@kb/kli/headless'

import { kbKliInput } from './kb_kli_input.ts'

/** Headless shell: {@link createKliHeadless} keeps `@opentui/*` out of the production compile graph. */
export const shell = createKliHeadless(kbKliInput)
