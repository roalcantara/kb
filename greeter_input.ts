import type { tags } from 'typia'

const GREETER_MIN_NAME_LENGTH = 1 as const
const GREETER_MIN_TIMES = 1 as const

export type GreeterInput = {
  name: string & tags.MinLength<typeof GREETER_MIN_NAME_LENGTH>
  times?: number & tags.Type<'uint32'> & tags.Minimum<typeof GREETER_MIN_TIMES>
}
