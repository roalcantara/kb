import { createKli } from '@kb/kli'

import { kliDefinition } from './entry/definition.kli.ts'

export const shell = createKli(kliDefinition)
