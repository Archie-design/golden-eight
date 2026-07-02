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

/**
 * 從已載入的假日集合，純記憶體計算區間（含起訖）工作日數。
 * 無 DB 呼叫，適合在迴圈中對每位成員以不同的 `from` 反覆計算
 * （避免每人各發一次 taiwan_holidays 查詢）。
 */
export function countWorkingDays(
  from: string,
  to: string,
  holidaySet: Set<string>
): number {
  if (from > to) return 0

  let workdays = 0
  for (let cur = from; cur <= to; cur = nextDay(cur)) {
    const dow = dowFromDateStr(cur)
    if (dow >= 1 && dow <= 5 && !holidaySet.has(cur)) workdays++
  }
  return workdays
}

/** 撈出區間內落在平日的台灣國定假日日期集合（供 countWorkingDays 反覆使用） */
export async function fetchWeekdayHolidaySet(
  from: string,
  to: string,
  db: SupabaseClient
): Promise<Set<string>> {
  if (from > to) return new Set()
  const { data } = await db
    .from('taiwan_holidays')
    .select('date')
    .gte('date', from)
    .lte('date', to)

  const set = new Set<string>()
  for (const h of (data ?? []) as { date: string }[]) {
    const dow = dowFromDateStr(h.date)
    if (dow >= 1 && dow <= 5) set.add(h.date)
  }
  return set
}

/** 計算指定日期區間（含起訖）內的工作日數（去除週末與台灣國定假日） */
export async function getWorkingDaysInRange(
  from: string,
  to: string,
  db: SupabaseClient
): Promise<number> {
  if (from > to) return 0
  const holidaySet = await fetchWeekdayHolidaySet(from, to, db)
  return countWorkingDays(from, to, holidaySet)
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
