const CACHE = 'golden-eight-v2'
const ICONS_CACHE = 'golden-eight-icons-v1'
const PRECACHE = ['/', '/checkin', '/dashboard']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== ICONS_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  // 只處理 GET，API 永遠走網路
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('/api/')) return

  // 任務圖示走 cache-first（圖檔不變動，命中即返回，省下重複下載）
  if (e.request.url.includes('/icons/tasks/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          const clone = res.clone()
          caches.open(ICONS_CACHE).then(c => c.put(e.request, clone))
          return res
        })
      })
    )
    return
  }

  // 其他資源：network-first，離線時 fallback 到 cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
