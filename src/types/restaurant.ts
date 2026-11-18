export type Category = 'all' | 'chinese' | 'fastfood' | 'noodles' | 'other'
export interface Coordinates { lng: number; lat: number; coordsys: 'wgs84' | 'gcj02' }
export interface SearchLocation extends Coordinates { label: string; accuracy?: number }
export interface Restaurant {
  id: string
  name: string
  address: string
  location: { lng: number; lat: number }
  distance: number | null
  category: Exclude<Category, 'all'>
  categoryLabel: string
  rating: number | null
  averagePrice: number | null
  businessHours: string | null
  telephone: string | null
}
export interface RestaurantResponse {
  restaurants: Restaurant[]
  center: Coordinates
  total: number | null
  truncated: boolean
}
export interface HistoryEntry { name: string; address: string; drawnAt: string }
