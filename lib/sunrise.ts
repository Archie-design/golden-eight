// ============================================================
// 台北日出時間 — DB 快取 + 外部 API 回源
// 審查報告 P1-7：跨 serverless instance 持久化，避免重複打外部 API。
// ============================================================

import { createServerClient } from './supabase/server'

const TAIPEI_LAT = 25.0330
const TAIPEI_LNG = 121.5654

async function fetchSunriseFromAPI(dateStr: string): Promise<string> {
  const url =
    `https://api.sunrise-sunset.org/json` +
    `?lat=${TAIPEI_LAT}&lng=${TAIPEI_LNG}&date=${dateStr}&formatted=0`

  const res = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error(`sunrise API ${res.status}`)

  const json = (await res.json()) as {
    status: string
    results: { sunrise: string }
  }
  if (json.status !== 'OK') throw new Error('sunrise API bad status')

  const utc = new Date(json.results.sunrise)
  const taipeiHour = (utc.getUTCHours() + 8) % 24
  const taipeiMin  = utc.getUTCMinutes()

  return (
    String(taipeiHour).padStart(2, '0') + ':' +
    String(taipeiMin).padStart(2, '0')
  )
}

/** 取得指定日期的日出時間（台北）：DB → 外部 API → 失敗回 '06:00' */
export async function getSunriseTime(dateStr: string): Promise<string> {
  const db = createServerClient()

  const { data: cached } = await db
    .from('sunrise_cache').select('sunrise').eq('date', dateStr).maybeSingle()
  if (cached?.sunrise) return cached.sunrise as string

  try {
    const sunrise = await fetchSunriseFromAPI(dateStr)
    // upsert 以避免併發重寫；錯誤不阻斷回傳
    const { error } = await db
      .from('sunrise_cache')
      .upsert({ date: dateStr, sunrise, fetched_at: new Date().toISOString() }, { onConflict: 'date' })
    if (error) console.error('[sunrise] cache upsert failed', error)
    return sunrise
  } catch (err) {
    console.error('[sunrise] fetch failed, using fallback:', err)
    return '06:00'
  }
}

/**
 * 從 HH:MM 加 n 分鐘（n 可為負，往回推）。
 * 以 mod 1440 正規化到 [0,1440) 再拆時分——JS 的 % 對負數回負值，
 * 故不能直接 total%60，否則往回跨午夜會算出負時分。
 */
export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440
  return (
    String(Math.floor(total / 60)).padStart(2, '0') + ':' +
    String(total % 60).padStart(2, '0')
  )
}

/** 取得建議開始打拳時間（日出後 12 分鐘） */
export async function getPunchStartTime(dateStr: string): Promise<string> {
  return addMinutes(await getSunriseTime(dateStr), 12)
}

/** 建議入睡前的緩衝與睡眠時長（往回推算建議入睡時間用） */
export const SLEEP_BUFFER_MIN = 20   // 打拳前緩衝
export const SLEEP_HOURS      = 6    // 建議睡眠時長

/**
 * 取得建議入睡時間（前一晚）：建議打拳時間往回推 20 分緩衝 + 6 小時睡眠。
 * 任何合理日出，算出的入睡皆落在前一晚，故呈現端固定標「前一晚」。
 */
export async function getSuggestedSleepTime(dateStr: string): Promise<string> {
  const punchStart = await getPunchStartTime(dateStr)
  return addMinutes(punchStart, -(SLEEP_BUFFER_MIN + SLEEP_HOURS * 60))
}
