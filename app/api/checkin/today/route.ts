import { NextResponse } from 'next/server'
import { getCurrentMember, getCheckinDayTaipei, getTodayTaipei, getPrevDayStr, getMonthEnd } from '@/lib/api-helper'
import { getSunriseTime, addMinutes } from '@/lib/sunrise'
import { calcMonthStats } from '@/lib/scoring'

export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const today       = getCheckinDayTaipei()   // 打卡邏輯日（中午為邊界）
  const calendarDay = getTodayTaipei()         // 實際日曆日（顯示用）
  const prevDay     = getPrevDayStr(today)
  const yearMonth   = today.substring(0, 7)

  const [todayRec, prevRec, monthRecs, sunrise] = await Promise.all([
    db.from('checkin_records').select('*').eq('member_id', member.id).eq('date', today).maybeSingle(),
    db.from('checkin_records').select('punch_streak').eq('member_id', member.id).eq('date', prevDay).maybeSingle(),
    db.from('checkin_records').select('*').eq('member_id', member.id).gte('date', yearMonth + '-01').lte('date', getMonthEnd(yearMonth)),
    // P2-12：只呼叫一次 getSunriseTime，再以 addMinutes 導出建議開始時間
    getSunriseTime(calendarDay),
  ])

  const monthStats = calcMonthStats(member, monthRecs.data ?? [], today)

  const punchStreak = todayRec.data
    ? (todayRec.data as { punch_streak?: number }).punch_streak ?? 0
    : (prevRec.data as { punch_streak?: number } | null)?.punch_streak ?? 0

  return NextResponse.json({
    ok: true,
    today,
    calendarDay,
    sunrise,
    punchStart: addMinutes(sunrise, 12),
    punchStreak,
    monthRate:  monthStats.rate,
    todayRecord: todayRec.data
      ? {
          submitted:  true,
          totalScore: (todayRec.data as { total_score: number }).total_score,
          submitTime: (todayRec.data as { submit_time: string }).submit_time,
          tasks:      (todayRec.data as { tasks: boolean[] }).tasks,
          note:       (todayRec.data as { note?: string }).note ?? '',
          work_hours: (todayRec.data as { work_hours?: number | null }).work_hours ?? null,
        }
      : { submitted: false },
  })
}
