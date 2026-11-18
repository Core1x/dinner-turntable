import type { RestaurantResponse, SearchLocation } from '../types/restaurant'

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`${path}?${new URLSearchParams(params)}`, { signal: controller.signal, cache: 'no-store' })
    let data: any
    try { data = await response.json() } catch { throw new Error('服务响应异常，请确认 Pages Functions 已启动。') }
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '查询失败，请稍后重试。')
    return data as T
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('查询超时，请检查网络后重试。')
    if (error instanceof TypeError) throw new Error('网络连接失败，请检查网络后重试。')
    throw error
  } finally { clearTimeout(timer) }
}
export const geocodeAddress = (address: string) => get<{ locations: SearchLocation[] }>('/api/geocode', { address })
export const searchRestaurants = (location: SearchLocation, radius: number) => get<RestaurantResponse>('/api/restaurants', {
  lng: String(location.lng), lat: String(location.lat), coordsys: location.coordsys, radius: String(radius),
})
