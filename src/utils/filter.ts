import type { Category, Restaurant } from '../types/restaurant'
export function filterRestaurants(rows: Restaurant[], category: Category, budget: number | null, radius: number): Restaurant[] {
  return rows.filter(row => (category === 'all' || row.category === category)
    && (budget === null || (row.averagePrice !== null && row.averagePrice <= budget))
    && (row.distance === null || row.distance <= radius))
}
export function dedupeRestaurants(rows: Restaurant[]): Restaurant[] {
  const seen = new Set<string>()
  return rows.filter(row => {
    const key = row.id || `${row.name.trim()}\u001f${row.address.trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
