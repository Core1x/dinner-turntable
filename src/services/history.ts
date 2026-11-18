import type { HistoryEntry, Restaurant } from '../types/restaurant'

const key = 'dinner-wheel-history'
export function readHistory(): HistoryEntry[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(data)) return []
    return data.filter(row => row && typeof row.name === 'string' && typeof row.address === 'string'
      && typeof row.drawnAt === 'string' && Number.isFinite(Date.parse(row.drawnAt))).slice(0, 20)
      .map(row => ({ name: row.name, address: row.address, drawnAt: row.drawnAt }))
  } catch { return [] }
}
export function saveHistory(restaurant: Restaurant, previous: HistoryEntry[]): { entries: HistoryEntry[]; saved: boolean } {
  const entries = [{ name: restaurant.name, address: restaurant.address, drawnAt: new Date().toISOString() }, ...previous].slice(0, 20)
  try { localStorage.setItem(key, JSON.stringify(entries)); return { entries, saved: true } }
  catch { return { entries, saved: false } }
}
export function clearHistory(): boolean {
  try { localStorage.removeItem(key); return true } catch { return false }
}
