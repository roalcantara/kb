import typia from 'typia'

import type { GreeterInput } from '../../../apps/kb/src/core/greeter/greeter.input'

export const assertGreeterInput = typia.createAssert<GreeterInput>()
