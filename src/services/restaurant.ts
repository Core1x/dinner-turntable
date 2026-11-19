import type { RestaurantResponse, SearchLocation } from '../types/restaurant'
import { apiReasons, apiStages, QueryError, type ApiStage } from '../types/query'

async function get<T>(path: string, stage: ApiStage, params: Record<string, string>): Promise<T> {
  const controller = new AbortController()
  // Nearby search can use four 8-second upstream calls including its single retry.
  const timer = setTimeout(() => controller.abort(), stage === 'address-search' ? 22000 : 40000)
  function failure(message: string, detail: string) {
    return new QueryError(`${apiStages[stage]}失败。${message}`, `${stage} / ${detail}`)
  }
  try {
    const response = await fetch(`${path}?${new URLSearchParams(params)}`, { signal: controller.signal, cache: 'no-store' })
    let data: any
    try { data = await response.json() } catch {
      throw failure('服务响应异常，请稍后重试。', `HTTP ${response.status} / invalid-response`)
    }
    if (!response.ok) {
      if (data?.stage === 'coordinate-conversion' && stage === 'nearby-search') stage = data.stage
      const reason = apiReasons.includes(data?.reason) ? ` / ${data.reason}` : ''
      throw failure(typeof data?.error === 'string' ? data.error : '请稍后重试。', `HTTP ${response.status}${reason}`)
    }
    return data as T
  } catch (error) {
    if (controller.signal.aborted) throw failure('请求超时，请稍后重试。', 'client-timeout')
    if (error instanceof TypeError) throw failure('网络连接失败，请检查网络后重试。', 'client-network')
    throw error
  } finally { clearTimeout(timer) }
}
export const geocodeAddress = (address: string) => get<{ locations: SearchLocation[] }>('/api/geocode', 'address-search', { address })
export const searchRestaurants = (location: SearchLocation, radius: number) => get<RestaurantResponse>('/api/restaurants', 'nearby-search', {
  lng: String(location.lng), lat: String(location.lat), coordsys: location.coordsys, radius: String(radius),
})
