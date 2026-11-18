import type { SearchLocation } from '../types/restaurant'

export function locate(): Promise<SearchLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('当前浏览器不支持定位，请手动输入地址。'))
    navigator.geolocation.getCurrentPosition(position => resolve({
      lng: position.coords.longitude, lat: position.coords.latitude, coordsys: 'wgs84',
      label: '当前位置', accuracy: position.coords.accuracy,
    }), error => reject(new Error(error.code === 1
      ? '定位权限未开启，你可以在浏览器中授权，或手动输入地址。'
      : error.code === 3 ? '定位超时，请重试或手动输入地址。' : '暂时无法获取位置，请重试或手动输入地址。')),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 })
  })
}
