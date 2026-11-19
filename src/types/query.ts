export const apiStages = {
  'address-search': '地址查询',
  'coordinate-conversion': '坐标转换',
  'nearby-search': '附近餐厅查询',
} as const
export type ApiStage = keyof typeof apiStages

// Only these codes can be copied from a server response into a diagnostic.
export const apiReasons = ['timeout', 'network', 'upstream-http', 'upstream-busy', 'invalid-response', 'quota', 'configuration', 'upstream-rejected'] as const
export type ApiReason = typeof apiReasons[number]

export class QueryError extends Error {
  constructor(message: string, readonly diagnostic: string) { super(message) }
}
