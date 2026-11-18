import { describe, expect, it } from 'vitest'
import { filterRestaurants, dedupeRestaurants } from '../src/utils/filter'
import { nextRotation, randomIndex, mapUrl } from '../src/utils/wheel'
import type { Restaurant } from '../src/types/restaurant'

export const restaurant = (values: Partial<Restaurant> = {}): Restaurant => ({
  id: 'test-only-1', name: '测试餐厅（仅测试夹具）', address: '测试地址',
  location: { lng: 113.9, lat: 22.6 }, distance: 300, category: 'chinese', categoryLabel: '中餐',
  averagePrice: null, rating: null, telephone: null, businessHours: null, ...values,
})

describe('candidate filtering', () => {
  it('excludes unknown prices under a budget, preserves them without a budget', () => {
    const rows = [restaurant(), restaurant({ id: '2', averagePrice: 25 }), restaurant({ id: '3', averagePrice: 41 })]
    expect(filterRestaurants(rows, 'all', 40, 1000).map(r => r.id)).toEqual(['2'])
    expect(filterRestaurants(rows, 'all', null, 1000)).toHaveLength(3)
  })
  it('combines category and radius without treating absent distance as zero', () => {
    const rows = [restaurant(), restaurant({ id: '2', category: 'fastfood' }), restaurant({ id: '3', distance: 1200 })]
    expect(filterRestaurants(rows, 'chinese', null, 500).map(r => r.id)).toEqual(['test-only-1'])
  })
  it('deduplicates POI IDs and falls back to name plus address', () => {
    expect(dedupeRestaurants([restaurant(), restaurant(), restaurant({ id: '' }), restaurant({ id: '' })])).toHaveLength(2)
  })
})

describe('wheel geometry', () => {
  it('lands each possible result at the top pointer for 2–12 sectors, including repeated turns', () => {
    for (let count = 2; count <= 12; count++) {
      let rotation = 0
      for (let round = 0; round < 3; round++) for (let index = 0; index < count; index++) {
        const next = nextRotation(rotation, index, count)
        expect(next - rotation).toBeGreaterThanOrEqual(360 * 5)
        // SVG sectors begin at -90 degrees; inverse rotation identifies the pointer sector.
        const pointerAngle = ((-next % 360) + 360) % 360
        expect(Math.floor(pointerAngle / (360 / count))).toBe(index)
        rotation = next
      }
    }
  })
  it('selects equal integer buckets and rejects invalid spins', () => {
    expect([0, 0.249, 0.25, 0.5, 0.999].map(value => randomIndex(4, () => value))).toEqual([0, 0, 1, 2, 3])
    expect(() => randomIndex(1)).toThrow()
    expect(() => nextRotation(0, 3, 3)).toThrow()
  })
  it('uses an official marker URI with GCJ-02 coordinates and escaped names', () => {
    const url = new URL(mapUrl(restaurant({ name: 'A & B' })))
    expect(url.origin + url.pathname).toBe('https://uri.amap.com/marker')
    expect(url.searchParams.get('coordinate')).toBe('gaode')
    expect(url.searchParams.get('position')).toBe('113.9,22.6')
    expect(url.searchParams.get('name')).toBe('A & B')
  })
})
