import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as restaurants } from '../functions/api/restaurants'
import { onRequestGet as geocode } from '../functions/api/geocode'

const poi = (id = 'fixture-only-1') => ({
  id, name: '接口测试餐厅（仅测试）', address: '测试地址', location: '113.901,22.601',
  typecode: '050100', type: '餐饮服务;中餐厅;中餐厅', distance: '350',
  business: { cost: '35', rating: '4.5', tel: '123456', opentime_week: '周一至周日 10:00-22:00' },
})
function context(url: string, key: string | undefined = 'test-only-secret') {
  return { request: new Request(`https://test.invalid${url}`), env: { AMAP_WEB_KEY: key } } as unknown as Parameters<typeof restaurants>[0]
}
const ok = (body: object) => new Response(JSON.stringify({ status: '1', ...body }))
afterEach(() => vi.unstubAllGlobals())

describe('Pages Functions', () => {
  it.each(['lng=&lat=22', 'lng=181&lat=22', 'lng=113&lat=91', 'lng=113&lat=22&radius=99999', 'lng=113&lat=22&page=3', 'lng=113&lat=22&coordsys=bad', 'lng=113&lat=22&category=bad'])('rejects invalid parameters: %s', async query => {
    const response = await restaurants(context(`/api/restaurants?${query}`))
    expect(response.status).toBe(400)
  })
  it('reports missing server configuration without exposing secrets', async () => {
    const response = await restaurants(context('/api/restaurants?lng=113&lat=22', ''))
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('test-only-secret')
  })
  it('converts GPS exactly once, retrieves two pages and normalizes/deduplicates business fields', async () => {
    const urls: URL[] = []
    vi.stubGlobal('fetch', async (input: URL) => {
      const url = new URL(input); urls.push(url)
      if (url.pathname.includes('convert')) return ok({ locations: '113.9,22.6' })
      const rows = Array.from({ length: 25 }, (_, i) => poi(`fixture-${i}`))
      const first = url.searchParams.get('page_num') === '1'
      return ok({ count: first ? '25' : '2', pois: first ? rows : [poi('fixture-0'), poi('new')] })
    })
    const response = await restaurants(context('/api/restaurants?lng=113.89&lat=22.59&radius=1000'))
    expect(response.status).toBe(200)
    const body = await response.json() as any
    expect(body.restaurants).toHaveLength(26)
    expect(body.center).toEqual({ lng: 113.9, lat: 22.6, coordsys: 'gcj02' })
    expect(body.restaurants[0]).toMatchObject({ averagePrice: 35, rating: 4.5, distance: 350, businessHours: '周一至周日 10:00-22:00' })
    expect(body.truncated).toBe(false)
    expect(body.total).toBeNull()
    expect(urls.map(u => u.pathname)).toEqual(['/v3/assistant/coordinate/convert', '/v5/place/around', '/v5/place/around'])
    expect(urls[0]!.searchParams.get('coordsys')).toBe('gps')
    expect(urls[1]!.searchParams.get('location')).toBe('113.900000,22.600000')
    expect(urls[1]!.searchParams.get('show_fields')).toBe('business')
    expect(urls[2]!.searchParams.get('page_num')).toBe('2')
    expect(response.headers.get('Cache-Control')).toContain('no-store')
  })
  it('does not convert GCJ-02 and preserves missing fields as null', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (input: URL) => {
      urls.push(String(input))
      return ok({ count: '2', pois: [{ ...poi(), business: [], distance: [] }, { ...poi('bad'), location: 'broken' }] })
    })
    const response = await restaurants(context('/api/restaurants?lng=113.9&lat=22.6&coordsys=gcj02'))
    const body = await response.json() as any
    expect(urls).toHaveLength(1)
    expect(urls[0]).not.toContain('convert')
    expect(body.restaurants).toHaveLength(1)
    expect(body.restaurants[0]).toMatchObject({ averagePrice: null, rating: null, businessHours: null, distance: null, telephone: null })
  })
  it('caps full responses at two pages without claiming to know the total', async () => {
    const urls: URL[] = []
    vi.stubGlobal('fetch', async (input: URL) => {
      const url = new URL(input); urls.push(url)
      return ok({ count: '25', pois: Array.from({ length: 25 }, (_, i) => poi(`${url.searchParams.get('page_num')}-${i}`)) })
    })
    const response = await restaurants(context('/api/restaurants?lng=113.9&lat=22.6&coordsys=gcj02'))
    const body = await response.json() as any
    expect(urls).toHaveLength(2)
    expect(body.restaurants).toHaveLength(50)
    expect(body.total).toBeNull()
    expect(body.truncated).toBe(true)
  })
  it('limits outgoing GPS and GCJ-02 coordinate precision to six decimals', async () => {
    const urls: URL[] = []
    vi.stubGlobal('fetch', async (input: URL) => {
      const url = new URL(input); urls.push(url)
      return url.pathname.includes('convert') ? ok({ locations: '113.91234567,22.61234567' }) : ok({ pois: [], count: '0' })
    })
    await restaurants(context('/api/restaurants?lng=113.123456789&lat=22.123456789'))
    expect(urls[0]!.searchParams.get('locations')).toBe('113.123457,22.123457')
    expect(urls[1]!.searchParams.get('location')).toBe('113.912346,22.612346')
  })
  it.each(['error', 'network', 'malformed'])('sanitizes upstream %s failures', async kind => {
    vi.stubGlobal('fetch', async () => {
      if (kind === 'network') throw new Error('test-only-secret raw coordinates')
      if (kind === 'malformed') return new Response('invalid')
      return new Response(JSON.stringify({ status: '0', info: 'test-only-secret', infocode: '10001' }))
    })
    const response = await restaurants(context('/api/restaurants?lng=113&lat=22&coordsys=gcj02'))
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('test-only-secret')
  })
  it('returns geocoded alternatives tagged as GCJ-02', async () => {
    vi.stubGlobal('fetch', async (input: URL) => {
      const url = new URL(input)
      expect(url.pathname).toBe('/v3/geocode/geo')
      expect(url.searchParams.get('address')).toBe('深圳市南山区科技园')
      return ok({ geocodes: [{ formatted_address: '广东省深圳市南山区科技园', location: '113.9,22.6' }] })
    })
    const response = await geocode(context('/api/geocode?address=深圳市南山区科技园'))
    expect(await response.json()).toEqual({ locations: [{ label: '广东省深圳市南山区科技园', lng: 113.9, lat: 22.6, coordsys: 'gcj02' }] })
  })
  it('rejects empty and overlong geocoding addresses', async () => {
    expect((await geocode(context('/api/geocode?address='))).status).toBe(400)
    expect((await geocode(context(`/api/geocode?address=${'a'.repeat(201)}`))).status).toBe(400)
  })
  it('returns a truthful empty result', async () => {
    vi.stubGlobal('fetch', async () => ok({ pois: [], count: '0' }))
    const response = await restaurants(context('/api/restaurants?lng=113&lat=22&coordsys=gcj02'))
    expect(await response.json()).toMatchObject({ restaurants: [], total: 0, truncated: false })
  })
})
