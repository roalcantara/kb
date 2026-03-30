import { createKliHeadless } from '@kb/kli/headless'

import { kliDefinition } from './definition.kli.ts'

/** Headless shell: {@link createKliHeadless} keeps `@opentui/*` out of the production compile graph. */
export const shell = createKliHeadless(kliDefinition)
