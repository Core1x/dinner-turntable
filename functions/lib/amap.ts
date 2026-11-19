import type { Category, Restaurant } from '../../src/types/restaurant'
import type { ApiReason, ApiStage } from '../../src/types/query'

export interface Env { AMAP_WEB_KEY?: string }
export class ApiError extends Error {
  constructor(public status: number, message: string, public reason?: ApiReason, public retryable = false) { super(message) }
}
export const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
})
export function errorResponse(error: unknown, stage: ApiStage): Response {
  return error instanceof ApiError ? json({ error: error.message, stage, reason: error.reason }, error.status)
    : json({ error: '餐厅服务暂时无法连接，请稍后重试。', stage }, 502)
}
export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
export function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}
export function coordinates(value: unknown): { lng: number; lat: number } | null {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(value)) return null
  const [lng, lat] = value.split(',').map(Number) as [number, number]
  return Math.abs(lng) <= 180 && Math.abs(lat) <= 90 ? { lng, lat } : null
}
export function coordinateParam(params: URLSearchParams, key: 'lng' | 'lat'): number {
  const value = params.get(key)
  if (value === null || !/^-?\d+(?:\.\d+)?$/.test(value)) throw new ApiError(400, '请提供有效的经纬度。')
  const n = Number(value)
  if (!Number.isFinite(n) || Math.abs(n) > (key === 'lng' ? 180 : 90)) throw new ApiError(400, '经纬度超出有效范围。')
  return n
}
export const categoryLabels = { chinese: '中餐', fastfood: '快餐', noodles: '面食', other: '其他餐饮' } as const
export function categoryOf(code: string, type: string): Exclude<Category, 'all'> {
  if (/面食|面馆|拉面|米粉|米线/.test(type)) return 'noodles'
  if (code.startsWith('0501')) return 'chinese'
  if (code.startsWith('0503')) return 'fastfood'
  return 'other'
}
export function normalizePoi(poi: Record<string, unknown>): Restaurant | null {
  const name = text(poi.name)
  const location = coordinates(poi.location)
  if (!name || !location) return null
  const code = text(poi.typecode) ?? ''
  if (code && !code.startsWith('05')) return null
  const category = categoryOf(code, text(poi.type) ?? '')
  const business = poi.business && typeof poi.business === 'object' && !Array.isArray(poi.business)
    ? poi.business as Record<string, unknown> : {}
  const rating = numeric(business.rating)
  const cost = numeric(business.cost)
  const address = text(poi.address) ?? ''
  return {
    id: text(poi.id) ?? '', name, address, location,
    distance: numeric(poi.distance), category, categoryLabel: categoryLabels[category],
    rating: rating !== null && rating <= 5 ? rating : null,
    averagePrice: cost !== null && cost > 0 ? cost : null,
    businessHours: text(business.opentime_week) ?? text(business.opentime_today),
    telephone: text(business.tel),
  }
}

const quotaCodes = new Set(['10003', '10004', '10014', '10015', '10019', '10020', '10021', '10029', '10044', '10045'])
const quotaError = () => new ApiError(502, '高德请求配额或频率已达上限，请稍后重试。', 'quota')

async function requestAmap(url: URL): Promise<Record<string, unknown>> {
  const signal = AbortSignal.timeout(8000)
  let data: Record<string, unknown>
  try {
    const response = await fetch(url, { signal, cache: 'no-store' })
    if (!response.ok) {
      if (response.status === 429) throw quotaError()
      throw new ApiError(502, '高德服务返回异常，请稍后重试。', 'upstream-http', [502, 503, 504].includes(response.status))
    }
    data = await response.json() as Record<string, unknown>
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    if (signal.aborted) throw new ApiError(502, '等待高德响应超时，请稍后重试。', 'timeout', true)
    if (cause instanceof SyntaxError) throw new ApiError(502, '高德服务返回的数据格式异常，请稍后重试。', 'invalid-response')
    throw new ApiError(502, '暂时无法连接高德服务，请稍后重试。', 'network', true)
  }
  if (!data || data.status !== '1') {
    const code = data?.infocode
    if (typeof code === 'string' && quotaCodes.has(code)) throw quotaError()
    if (code === '10016') throw new ApiError(502, '高德服务繁忙，请稍后重试。', 'upstream-busy')
    throw new ApiError(502, '高德查询失败，请维护者检查 Web 服务 Key、接口权限与配额。', 'upstream-rejected')
  }
  return data
}

export function createAmapClient(env: Env) {
  // Conversion and pagination share one retry per user request.
  let retryAvailable = true
  return async (path: string, params: Record<string, string>) => {
    const key = env.AMAP_WEB_KEY?.trim()
    if (!key || key === 'replace_with_your_amap_web_service_key') {
      throw new ApiError(503, '餐厅服务尚未配置高德 Key，请联系站点维护者。', 'configuration')
    }
    const url = new URL(path, 'https://restapi.amap.com')
    url.search = new URLSearchParams({ ...params, key, output: 'JSON' }).toString()
    try { return await requestAmap(url) } catch (error) {
      if (!(error instanceof ApiError) || !error.retryable || !retryAvailable) throw error
      retryAvailable = false
      return requestAmap(url)
    }
  }
}
