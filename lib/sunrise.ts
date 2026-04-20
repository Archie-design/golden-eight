// ============================================================
// 台北日出時間 — 即時從 sunrise-sunset.org API 取得
// 台北座標：25.0330°N, 121.5654°E（UTC+8）
// ============================================================

const TAIPEI_LAT = 25.0330
const TAIPEI_LNG = 121.5654

async function fetchSunriseFromAPI(dateStr: string): Promise<string> {
  const url =
    `https://api.sunrise-sunset.org/json` +
    `?lat=${TAIPEI_LAT}&lng=${TAIPEI_LNG}&date=${dateStr}&formatted=0`

  const res = await fetch(url, {
    // Next.js fetch cache：同一日期只打一次，隔天自動更新
    next: { revalidate: 86400 },
  })

  if (!res.ok) throw new Error(`sunrise API ${res.status}`)

  const json = (await res.json()) as {
    status: string
    results: { sunrise: string }
  }

  if (json.status !== 'OK') throw new Error('sunrise API bad status')

  // API 回傳 UTC ISO 字串，轉換成台北時間（UTC+8）
  const utc = new Date(json.results.sunrise)
  const taipeiHour = (utc.getUTCHours() + 8) % 24
  const taipeiMin  = utc.getUTCMinutes()

  return (
    String(taipeiHour).padStart(2, '0') + ':' +
    String(taipeiMin).padStart(2, '0')
  )
}

/** 取得指定日期的日出時間（台北，即時）；失敗時回傳 '06:00' */
export async function getSunriseTime(dateStr: string): Promise<string> {
  try {
    return await fetchSunriseFromAPI(dateStr)
  } catch (err) {
    console.error('[sunrise] fetch failed, using fallback:', err)
    return '06:00'
  }
}

/** 取得建議開始打拳時間（日出後 12 分鐘） */
export async function getPunchStartTime(dateStr: string): Promise<string> {
  const sunrise = await getSunriseTime(dateStr)
  const [h, m] = sunrise.split(':').map(Number)
  const total   = h * 60 + m + 12
  return (
    String(Math.floor(total / 60)).padStart(2, '0') + ':' +
    String(total % 60).padStart(2, '0')
  )
}
