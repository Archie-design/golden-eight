import type { SupabaseClient } from '@supabase/supabase-js'

export async function getWorkingDaysInMonth(
  yearMonth: string,
  db: SupabaseClient
): Promise<number> {
  const [year, month] = yearMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()

  let weekdays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow >= 1 && dow <= 5) weekdays++
  }

  const from = `${yearMonth}-01`
  const to   = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`
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
