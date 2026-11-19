import type { SearchLocation } from '../types/restaurant'
import { QueryError } from '../types/query'

type Policy = { allowsFeature?: (feature: string) => boolean }
function policyBlocksLocation(): boolean {
  const page = document as Document & { permissionsPolicy?: Policy; featurePolicy?: Policy }
  try {
    const policy = page.permissionsPolicy ?? page.featurePolicy
    return policy?.allowsFeature?.('geolocation') === false
  } catch { return false } // Some embedded browsers expose an incomplete policy API.
}

const messages = {
  insecure: '请通过 HTTPS 打开网站以获取设备位置，或手动输入地址。',
  'policy-blocked': '当前页面的权限策略阻止了定位，请在浏览器中直接打开网站，或输入地址。',
  unsupported: '当前浏览器未提供定位功能，请手动输入地址。',
  'security-error': '浏览器限制了此页面的位置访问，请在浏览器中直接打开网站，或手动输入地址。',
  'denied(1)': '未获得定位权限。请检查手机定位开关、浏览器 App 的位置权限，以及此网站的定位授权，或手动输入地址。',
  'unavailable(2)': '设备暂时无法提供位置。请检查手机定位服务，可换到开阔处重试，或手动输入附近地标。',
  'timeout(3)': '获取设备位置超时。请确认已处理定位授权提示，或手动输入附近地标。',
  'no-callback': '浏览器未及时返回位置。请确认定位授权提示，或手动输入附近地标。',
  'invalid-position': '设备返回的位置无效，请手动输入附近地标。',
  'provider-error': '浏览器定位服务暂时不可用，请手动输入附近地标。',
}
type Failure = keyof typeof messages
type Outcome = { point: SearchLocation } | { failure: Failure }

function attempt(geo: Geolocation, precise: boolean, signal?: AbortSignal): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    // The native timeout may exclude time spent waiting for permission.
    const timer = setTimeout(() => finish({ failure: 'no-callback' }), precise ? 20000 : 10000)
    let active = true
    function cleanup() {
      active = false
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
    }
    function finish(outcome: Outcome) {
      if (!active) return
      cleanup()
      resolve(outcome)
    }
    function cancel() {
      cleanup()
      reject(new DOMException('已取消定位', 'AbortError'))
    }
    if (signal?.aborted) return cancel()
    signal?.addEventListener('abort', cancel)
    try {
      geo.getCurrentPosition(position => {
        const { longitude: lng, latitude: lat, accuracy } = position.coords
        if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
          return finish({ failure: 'invalid-position' })
        }
        finish({ point: { lng, lat, coordsys: 'wgs84', label: '当前位置',
          accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined } })
      }, error => {
        const codes: Record<number, Failure> = { 1: 'denied(1)', 2: 'unavailable(2)', 3: 'timeout(3)' }
        finish({ failure: codes[error.code] ?? 'provider-error' })
      }, { enableHighAccuracy: precise, timeout: precise ? 12000 : 8000, maximumAge: 60000 })
    } catch (cause) {
      finish({ failure: (cause as Error | null)?.name === 'SecurityError' ? 'security-error' : 'provider-error' })
    }
  })
}

export async function locate(signal?: AbortSignal): Promise<SearchLocation> {
  const trace = ['browser-location']
  function blocked(code: Failure) { return new QueryError(messages[code], 'browser-location / ' + code) }
  if (window.isSecureContext === false) throw blocked('insecure')
  if (policyBlocksLocation()) throw blocked('policy-blocked')
  let geo: Geolocation
  try { geo = navigator.geolocation } catch { throw blocked('security-error') }
  if (typeof geo?.getCurrentPosition !== 'function') throw blocked('unsupported')
  let lastFailure: Failure = 'provider-error'
  for (const precise of [true, false]) {
    const outcome = await attempt(geo, precise, signal)
    if ('point' in outcome) return outcome.point
    lastFailure = outcome.failure
    trace.push(`${precise ? 'precise' : 'standard'}=${lastFailure}`)
    if (lastFailure === 'denied(1)' || lastFailure === 'security-error') break
  }
  throw new QueryError(messages[lastFailure], trace.join(' / '))
}
