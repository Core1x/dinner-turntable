import { createAmapClient, ApiError, coordinates, errorResponse, json, text, type Env } from '../lib/amap'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const params = new URL(request.url).searchParams
    const address = params.get('address')?.trim() ?? ''
    const city = params.get('city')?.trim() ?? ''
    if (!address || address.length > 200 || city.length > 50) throw new ApiError(400, '地址需为 1–200 字，城市最多 50 字。')
    const amap = createAmapClient(env)
    const result = await amap('/v3/geocode/geo', { address, ...(city ? { city } : {}) })
    if (!Array.isArray(result.geocodes)) throw new ApiError(502, '高德地址数据格式异常，请稍后重试。')
    const locations = result.geocodes.slice(0, 10).flatMap(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return []
      const point = coordinates(value.location)
      const label = text(value.formatted_address)
      return point && label ? [{ label, ...point, coordsys: 'gcj02' }] : []
    })
    return json({ locations })
  } catch (error) { return errorResponse(error, 'address-search') }
}
