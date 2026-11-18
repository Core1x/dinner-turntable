import { amap, ApiError, coordinateParam, coordinates, errorResponse, json, normalizePoi, type Env } from '../lib/amap'
import { dedupeRestaurants, filterRestaurants } from '../../src/utils/filter'
import type { Category, Restaurant } from '../../src/types/restaurant'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const params = new URL(request.url).searchParams
    let lng = coordinateParam(params, 'lng')
    let lat = coordinateParam(params, 'lat')
    const radiusText = params.get('radius') ?? '1000'
    if (!['500', '1000', '2000', '3000'].includes(radiusText)) throw new ApiError(400, '搜索半径只能为 500、1000、2000 或 3000 米。')
    const radius = Number(radiusText)
    const coordsys = params.get('coordsys') ?? 'wgs84'
    if (!['wgs84', 'gcj02'].includes(coordsys)) throw new ApiError(400, '坐标系无效。')
    const category = params.get('category') ?? 'all'
    if (!['all', 'chinese', 'fastfood', 'noodles', 'other'].includes(category)) throw new ApiError(400, '餐饮类别无效。')
    const page = params.get('page')
    if (page !== null && !['1', '2'].includes(page)) throw new ApiError(400, '页码只能为 1 或 2。')
    if (coordsys === 'wgs84') {
      const converted = await amap('/v3/assistant/coordinate/convert', { locations: `${lng.toFixed(6)},${lat.toFixed(6)}`, coordsys: 'gps' }, env)
      const point = coordinates(converted.locations)
      if (!point) throw new ApiError(502, '高德坐标转换未返回有效位置，请重新定位。')
      ;({ lng, lat } = point)
    }
    const rows: Restaurant[] = []
    let lastPageSize = 0
    for (const pageNumber of page ? [Number(page)] : [1, 2]) {
      const result = await amap('/v5/place/around', {
        location: `${lng.toFixed(6)},${lat.toFixed(6)}`, radius: radiusText, types: '050000', sortrule: 'distance',
        page_size: '25', page_num: String(pageNumber), show_fields: 'business',
      }, env)
      if (!Array.isArray(result.pois)) throw new ApiError(502, '高德餐厅数据格式异常，请稍后重试。')
      lastPageSize = result.pois.length
      for (const poi of result.pois.slice(0, 25)) {
        if (poi && typeof poi === 'object' && !Array.isArray(poi)) {
          const row = normalizePoi(poi as Record<string, unknown>)
          if (row) rows.push(row)
        }
      }
      // v5 count is the current response size, not a total across pages.
      if (lastPageSize < 25) break
    }
    return json({
      restaurants: filterRestaurants(dedupeRestaurants(rows), category as Category, null, radius),
      center: { lng, lat, coordsys: 'gcj02' },
      total: !page && lastPageSize === 0 && rows.length === 0 ? 0 : null,
      truncated: lastPageSize === 25,
    })
  } catch (error) { return errorResponse(error) }
}
