import type { Restaurant } from '../types/restaurant'
export function nextRotation(current: number, index: number, count: number): number {
  if (!Number.isInteger(count) || count < 2 || !Number.isInteger(index) || index < 0 || index >= count || !Number.isFinite(current)) throw new Error('无效转盘参数')
  // Sector i starts at i * step measured clockwise from the top. Aim its center at 0°.
  const target = (360 - (index + 0.5) * (360 / count)) % 360
  const normalized = ((current % 360) + 360) % 360
  return current + 360 * 5 + ((target - normalized + 360) % 360)
}
export function randomIndex(count: number, random = Math.random): number {
  if (!Number.isInteger(count) || count < 2) throw new Error('至少需要两家餐厅')
  const value = random()
  if (value < 0 || value >= 1 || !Number.isFinite(value)) throw new Error('无效随机数')
  return Math.floor(value * count)
}
export function mapUrl(restaurant: Restaurant): string {
  const url = new URL('https://uri.amap.com/marker')
  url.search = new URLSearchParams({
    position: `${restaurant.location.lng},${restaurant.location.lat}`,
    name: restaurant.name, coordinate: 'gaode', src: 'dinner-wheel', callnative: '1',
  }).toString()
  return url.toString()
}
