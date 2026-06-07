import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 從 'YYYY-MM-DD' 字串算出星期幾（0=日 ~ 6=六），TZ 獨立。
 * 用 Date.UTC 構造 UTC 午夜，再用 getUTCDay()，完全不依賴 process.env.TZ。
 */
function dowFromDateStr(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** 純字串遞增一天 */
function nextDay(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** 計算指定日期區間（含起訖）內的工作日數（去除週末與台灣國定假日） */
export async function getWorkingDaysInRange(
  from: string,
  to: string,
  db: SupabaseClient
): Promise<number> {
  if (from > to) return 0

  let weekdays = 0
  for (let cur = from; cur <= to; cur = nextDay(cur)) {
    const dow = dowFromDateStr(cur)
    if (dow >= 1 && dow <= 5) weekdays++
  }

  const { data } = await db
    .from('taiwan_holidays')
    .select('date')
    .gte('date', from)
    .lte('date', to)

  const holidaysOnWeekdays = ((data ?? []) as { date: string }[]).filter(h => {
    const dow = dowFromDateStr(h.date)
    return dow >= 1 && dow <= 5
  }).length

  return Math.max(0, weekdays - holidaysOnWeekdays)
}

export async function getWorkingDaysInMonth(
  yearMonth: string,
  db: SupabaseClient
): Promise<number> {
  const [year, month] = yearMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const from = `${yearMonth}-01`
  const to   = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`
  return getWorkingDaysInRange(from, to, db)
}
