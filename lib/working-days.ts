import type { SupabaseClient } from '@supabase/supabase-js'

/** 計算指定日期區間（含起訖）內的工作日數（去除週末與台灣國定假日） */
export async function getWorkingDaysInRange(
  from: string,
  to: string,
  db: SupabaseClient
): Promise<number> {
  if (from > to) return 0

  let weekdays = 0
  const start = new Date(from + 'T00:00:00+08:00')
  const end   = new Date(to   + 'T00:00:00+08:00')
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) weekdays++
  }

  const { data } = await db
    .from('taiwan_holidays')
    .select('date')
    .gte('date', from)
    .lte('date', to)

  const holidaysOnWeekdays = ((data ?? []) as { date: string }[]).filter(h => {
    const dow = new Date(h.date + 'T00:00:00+08:00').getDay()
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
