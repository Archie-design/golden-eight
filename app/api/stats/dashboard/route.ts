import { NextResponse } from 'next/server'
import { getCurrentMember, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats, calcMaxPunchStreak } from '@/lib/scoring'
import { getCalendarColor } from '@/lib/constants'
import type { CheckInRecord } from '@/types'

export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const today     = getTodayTaipei()
  const yearMonth = today.substring(0, 7)
  const day       = parseInt(today.split('-')[2], 10)
  const [monthRecsRes, achievementsRes] = await Promise.all([
    db.from('checkin_records').select('*').eq('member_id', member.id).gte('date', yearMonth + '-01').lte('date', getMonthEnd(yearMonth)).order('date'),
    db.from('achievements').select('*').eq('member_id', member.id),
  ])

  const monthRecs = (monthRecsRes.data ?? []) as CheckInRecord[]
  const stats     = calcMonthStats(member, monthRecs, today)
  const maxStreak = calcMaxPunchStreak(monthRecs)

  // 月曆格
  const daysInMonth = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0).getDate()
  const calendar = Array.from({ length: daysInMonth }, (_, i) => {
    const d    = `${yearMonth}-${String(i + 1).padStart(2, '0')}`
    const rec  = monthRecs.find(r => r.date === d)
    const score = rec ? rec.total_score : null
    return { date: d, day: i + 1, score, color: getCalendarColor(score), note: rec?.note ?? '' }
  })

  // 各任務累計次數
  const taskCounts = Array.from({ length: 8 }, (_, i) => monthRecs.filter(r => r.tasks[i]).length)

  // 目前連續打拳天數
  const lastRec = monthRecs.at(-1)
  const punchStreak = lastRec?.tasks[1]
    ? (lastRec as { punch_streak?: number }).punch_streak ?? 0
    : 0

  return NextResponse.json({
    ok: true,
    yearMonth,
    user:         { level: member.level, nextLevel: member.next_level ?? undefined },
    totalScore:   stats.totalScore,
    maxScore:     stats.maxScore,
    rate:         stats.rate,
    targetScore:  stats.targetScore,
    remaining:    stats.remaining,
    punchStreak,
    maxPunchMonth: maxStreak,
    calendar,
    taskCounts,
    achievements:     achievementsRes.data ?? [],
    showNextLevelBtn: day >= 25,
    line: {
      bound:       !!member.line_user_id,
      displayName: member.line_display_name ?? null,
      pictureUrl:  member.line_picture_url  ?? null,
    },
  })
}
