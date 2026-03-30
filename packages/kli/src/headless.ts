/**
 * Headless-only API: no `createKli` / `main.cli` graph. Use from production compile entries so
 * `bun build --compile --target=…` never resolves `@opentui/core-*`.
 */
export type { CliMiddlewareContext, Middleware, OptsDef } from '@kli/core/cli'
export type { CreateKliInput, KliHandle, KliSetupOptions } from './shell/cli/factories/create_kli_handle.factory.ts'
export { createKliHeadless } from './shell/cli/factories/create_kli_headless.factory.ts'
