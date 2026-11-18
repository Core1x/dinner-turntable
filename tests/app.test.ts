// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.vue'

const rows = [
  { id: 'test-1', name: '测试候选甲（测试专用）', address: '测试路1号', location: { lng: 113.9, lat: 22.6 }, distance: 200, category: 'chinese', categoryLabel: '中餐', averagePrice: 25, rating: 4, businessHours: null, telephone: null },
  { id: 'test-2', name: '测试候选乙（测试专用）', address: '测试路2号', location: { lng: 113.91, lat: 22.61 }, distance: 400, category: 'fastfood', categoryLabel: '快餐', averagePrice: null, rating: null, businessHours: null, telephone: null },
]
const wrappers: ReturnType<typeof mount>[] = []
const render = () => { const wrapper = mount(App); wrappers.push(wrapper); return wrapper }
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', async (input: string) => new Response(JSON.stringify(input.includes('geocode')
    ? { locations: [{ lng: 113.9, lat: 22.6, coordsys: 'gcj02', label: '测试搜索位置' }] }
    : { restaurants: rows, center: { lng: 113.9, lat: 22.6, coordsys: 'gcj02' }, total: 2, truncated: false })))
})
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.unstubAllGlobals(); vi.useRealTimers() })
async function search(wrapper: ReturnType<typeof render>) {
  await wrapper.get('[data-test=address]').setValue('深圳市科技园')
  await wrapper.get('[data-test=address-form]').trigger('submit')
  await flushPromises()
}
describe('user flows', () => {
  it('starts with an honest empty state and requests no location permission until clicked', () => {
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    const wrapper = render()
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(wrapper.get('[data-test=spin]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('先选一个出发点')
    expect(wrapper.text()).not.toContain('测试候选')
  })
  it('geocodes an address and displays actual response data, including unknown prices', async () => {
    const wrapper = render()
    await search(wrapper)
    expect(wrapper.text()).toContain('测试候选甲')
    expect(wrapper.text()).toContain('价格未知')
    expect(wrapper.get('[data-test=spin]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-test=budget]').setValue('40')
    expect(wrapper.get('[data-test=spin]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('[data-test=restaurant]')).toHaveLength(1)
  })
  it('freezes candidates while spinning, settles the matching result, and stores only name/address/time', async () => {
    const wrapper = render()
    await search(wrapper)
    vi.useFakeTimers()
    await wrapper.get('[data-test=spin]').trigger('click')
    expect(wrapper.get('[data-test=spin]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test=budget]').attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(6000)
    await flushPromises()
    expect(wrapper.find('[data-test=result]').exists()).toBe(true)
    const history = JSON.parse(localStorage.getItem('dinner-wheel-history') ?? '[]')
    expect(history).toHaveLength(1)
    expect(Object.keys(history[0]).sort()).toEqual(['address', 'drawnAt', 'name'])
    expect(wrapper.get('[data-test=result]').text()).toContain(history[0].name)
    await wrapper.get('[data-test=confirm]').trigger('click')
    expect(wrapper.text()).toContain('今晚就去这家')
    await wrapper.get('[data-test=spin]').trigger('click')
    expect(wrapper.find('[data-test=result]').exists()).toBe(false)
  })
  it('explains denied geolocation and keeps manual address available', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) => fail({ code: 1 }) } })
    const wrapper = render()
    await wrapper.get('[data-test=locate]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('定位权限')
    expect(wrapper.find('[data-test=address]').exists()).toBe(true)
  })
  it('shows backend errors and never substitutes fictional restaurant data', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: '高德服务暂时不可用' }), { status: 502 }))
    const wrapper = render()
    await search(wrapper)
    expect(wrapper.text()).toContain('高德服务暂时不可用')
    expect(wrapper.findAll('[data-test=restaurant]')).toHaveLength(0)
  })
})
