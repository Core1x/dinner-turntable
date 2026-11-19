// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { locate } from '../src/services/location'

type Call = { ok: PositionCallback; fail: PositionErrorCallback; options: PositionOptions }
const calls: Call[] = []
const signal = () => new AbortController().signal
const position = { coords: { longitude: 113.9, latitude: 22.6, accuracy: 40 } } as GeolocationPosition
const failure = (code: number) => ({ code, message: 'sensitive provider text' }) as GeolocationPositionError

beforeEach(() => {
  vi.useFakeTimers()
  calls.length = 0
  vi.stubGlobal('navigator', { geolocation: {
    getCurrentPosition(ok: PositionCallback, fail: PositionErrorCallback, options: PositionOptions) {
      calls.push({ ok, fail, options })
    },
  } })
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('browser location', () => {
  it.each([2, 3])('recovers from native error %i using standard accuracy', async code => {
    const pending = locate(signal())
    calls[0]!.fail(failure(code))
    await Promise.resolve()
    expect(calls.map(call => call.options.enableHighAccuracy)).toEqual([true, false])
    calls[1]!.ok(position)
    await expect(pending).resolves.toMatchObject({ lng: 113.9, coordsys: 'wgs84', accuracy: 40 })
    expect(vi.getTimerCount()).toBe(0)
  })
  it('stops on denial and exposes only an allowlisted diagnostic', async () => {
    const pending = locate(signal())
    calls[0]!.fail(failure(1))
    await expect(pending).rejects.toMatchObject({ diagnostic: 'browser-location / precise=denied(1)' })
    expect(calls).toHaveLength(1)
  })
  it('times out silent providers and ignores late callbacks from the first attempt', async () => {
    const pending = locate(signal())
    const check = expect(pending).rejects.toMatchObject({
      diagnostic: 'browser-location / precise=no-callback / standard=no-callback',
    })
    await vi.advanceTimersByTimeAsync(20000)
    expect(calls).toHaveLength(2)
    calls[0]!.ok(position)
    await vi.advanceTimersByTimeAsync(10000)
    await check
    expect(vi.getTimerCount()).toBe(0)
  })
  it('ignores callbacks and clears timers after cancellation', async () => {
    const controller = new AbortController()
    const pending = locate(controller.signal)
    controller.abort()
    calls[0]!.fail(failure(2))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('explains insecure contexts without requesting permission', async () => {
    vi.stubGlobal('isSecureContext', false)
    await expect(locate(signal())).rejects.toMatchObject({ diagnostic: 'browser-location / insecure' })
    expect(calls).toHaveLength(0)
  })
  it('reports explicit policy blocking separately from denial', async () => {
    Object.defineProperty(document, 'featurePolicy', { configurable: true, value: { allowsFeature: () => false } })
    try {
      await expect(locate(signal())).rejects.toMatchObject({ diagnostic: 'browser-location / policy-blocked' })
      expect(calls).toHaveLength(0)
    } finally { Reflect.deleteProperty(document, 'featurePolicy') }
  })
})
