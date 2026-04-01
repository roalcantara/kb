import { shell } from '../main.ts'
import {
  defineCacheCommand,
  defineConfigCommand,
  defineDbCommand,
  defineImportCommand,
  defineListCommand,
  defineViewCommand
} from './index.ts'

export const commands = [
  defineConfigCommand(shell),
  defineImportCommand(shell),
  defineListCommand(shell),
  defineViewCommand(shell),
  defineDbCommand(shell),
  defineCacheCommand(shell)
] as const
