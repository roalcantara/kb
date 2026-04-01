export const FORMATS = ['pretty', 'json', 'raw'] as const
export type Format = (typeof FORMATS)[number]
