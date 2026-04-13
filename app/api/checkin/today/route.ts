import { NextResponse } from 'next/server'
import { getCurrentMember, getTodayTaipei, getYesterdayTaipei, getNowHourTaipei, getMonthEnd } from '@/lib/api-helper'
import { getSunriseTime, getPunchDeadline } from '@/lib/sunrise'
import { calcMonthStats } from '@/lib/scoring'

export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const today     = getTodayTaipei()
  const yesterday = getYesterdayTaipei()
  const nowHour   = getNowHourTaipei()
  const yearMonth = today.substring(0, 7)

  const [todayRec, yesterdayRec, monthRecs] = await Promise.all([
    db.from('checkin_records').select('*').eq('member_id', member.id).eq('date', today).maybeSingle(),
    db.from('checkin_records').select('id').eq('member_id', member.id).eq('date', yesterday).maybeSingle(),
    db.from('checkin_records').select('*').eq('member_id', member.id).gte('date', yearMonth + '-01').lte('date', getMonthEnd(yearMonth)),
  ])

  const monthStats = calcMonthStats(member, monthRecs.data ?? [], today)

  // 目前連續打拳天數
  const punchStreak = todayRec.data
    ? (todayRec.data as { punch_streak?: number }).punch_streak ?? 0
    : (() => {
        const yrec = yesterdayRec.data as unknown as { punch_streak?: number } | null
        return yrec ? (yrec.punch_streak ?? 0) : 0
      })()

  const canMakeup = !yesterdayRec.data && nowHour < 12

  return NextResponse.json({
    ok: true,
    today,
    sunrise:       await getSunriseTime(today),
    punchDeadline: await getPunchDeadline(today),
    punchStreak,
    monthRate:     monthStats.rate,
    todayRecord:   todayRec.data
      ? { submitted: true, totalScore: (todayRec.data as { total_score: number }).total_score, submitTime: (todayRec.data as { submit_time: string }).submit_time }
      : { submitted: false },
    canMakeup,
    yesterday: canMakeup ? yesterday : null,
  })
}
