import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats, calcMaxPunchStreakFromSorted } from '@/lib/scoring'
import { getCalendarColor } from '@/lib/constants'
import { getWorkingDaysInMonth } from '@/lib/working-days'
import { RECORD_COLS_STATS } from '@/lib/db-columns'
import type { CheckInRecord } from '@/types'

export async function GET(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const today            = getTodayTaipei()
  const currentYearMonth = today.substring(0, 7)
  const day              = parseInt(today.split('-')[2], 10)

  const rawMonth  = new URL(request.url).searchParams.get('month') ?? ''
  const yearMonth = /^\d{4}-\d{2}$/.test(rawMonth) && rawMonth <= currentYearMonth
    ? rawMonth : currentYearMonth
  const isCurrentMonth = yearMonth === currentYearMonth
  // 歷史月份以月底為基準，使 calcMonthStats 的分母涵蓋完整一個月
  const refDate = isCurrentMonth ? today : getMonthEnd(yearMonth)

  const [monthRecsRes, achievementsRes, workingDays] = await Promise.all([
    db.from('checkin_records').select(RECORD_COLS_STATS)
      .eq('member_id', member.id)
      .gte('date', yearMonth + '-01')
      .lte('date', getMonthEnd(yearMonth))
      .order('date'),
    db.from('achievements').select('code, unlocked_at').eq('member_id', member.id),
    getWorkingDaysInMonth(yearMonth, db),
  ])

  const monthRecs = (monthRecsRes.data ?? []) as CheckInRecord[]
  const stats     = calcMonthStats(member, monthRecs, refDate)
  const maxStreak = calcMaxPunchStreakFromSorted(monthRecs)

  const daysInMonth = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0).getDate()
  const calendar = Array.from({ length: daysInMonth }, (_, i) => {
    const d    = `${yearMonth}-${String(i + 1).padStart(2, '0')}`
    const rec  = monthRecs.find(r => r.date === d)
    const score = rec ? rec.total_score : null
    return { date: d, day: i + 1, score, color: getCalendarColor(score), note: rec?.note ?? '' }
  })

  const taskCounts = Array.from({ length: 8 }, (_, i) => monthRecs.filter(r => r.tasks[i]).length)

  const monthWorkHours    = monthRecs.reduce((s, r) => s + ((r as CheckInRecord & { work_hours?: number | null }).work_hours ?? 0), 0)
  const requiredWorkHours = workingDays * 8

  const lastRec = monthRecs.at(-1)
  const punchStreak = lastRec?.tasks[1]
    ? (lastRec as { punch_streak?: number }).punch_streak ?? 0
    : 0

  return NextResponse.json({
    ok: true,
    yearMonth,
    isCurrentMonth,
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
    monthWorkHours,
    requiredWorkHours,
    workingDays,
    achievements:     achievementsRes.data ?? [],
    showNextLevelBtn: isCurrentMonth && day >= 25,
    line: {
      bound:       !!member.line_user_id,
      displayName: member.line_display_name ?? null,
      pictureUrl:  member.line_picture_url  ?? null,
    },
  })
}
