import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats } from '@/lib/scoring'
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

  const [monthRecsRes, achievementsRes, workingDays, latestRecRes] = await Promise.all([
    db.from('checkin_records').select(RECORD_COLS_STATS)
      .eq('member_id', member.id)
      .gte('date', yearMonth + '-01')
      .lte('date', getMonthEnd(yearMonth))
      .order('date'),
    db.from('achievements').select('code, unlocked_at').eq('member_id', member.id),
    getWorkingDaysInMonth(yearMonth, db),
    isCurrentMonth
      ? db.from('checkin_records').select('tasks, punch_streak, date')
          .eq('member_id', member.id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const monthRecs = (monthRecsRes.data ?? []) as CheckInRecord[]
  const stats     = calcMonthStats(member, monthRecs, refDate)
  // 跨月感知：取當月紀錄裡 punch_streak 欄位的最大值（欄位本身已累積跨月計數）
  const maxStreak = monthRecs
    .filter(r => r.tasks[1])
    .reduce((m, r) => Math.max(m, (r as CheckInRecord & { punch_streak?: number }).punch_streak ?? 0), 0)

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

  // 本月視角：用「該成員最新一筆紀錄」（跨月）；歷史視角：用該月最後一筆
  let punchStreak = 0
  if (isCurrentMonth) {
    const latest = latestRecRes.data as { tasks?: boolean[]; punch_streak?: number } | null
    if (latest?.tasks?.[1]) punchStreak = latest.punch_streak ?? 0
  } else {
    const lastRec = monthRecs.at(-1)
    if (lastRec?.tasks[1]) punchStreak = (lastRec as { punch_streak?: number }).punch_streak ?? 0
  }

  // ── 日均達標門檻（前瞻提醒）：僅本月現時視圖、非豁免時計算 ──────────────
  // daysLeft 含今天（月底當天=1，不除零）；dailyNeeded = 距目標差 ÷ 剩餘天數。
  // targetStatus：achieved（已達標）/ unreachable（>8 分，超單日上限）/ on_track。
  let daysLeft: number | null = null
  let dailyNeeded: number | null = null
  let targetStatus: 'achieved' | 'on_track' | 'unreachable' | null = null
  if (isCurrentMonth && stats.maxScore > 0) {
    const monthEndDay = parseInt(getMonthEnd(yearMonth).split('-')[2], 10)
    daysLeft = monthEndDay - day + 1
    if (stats.remaining <= 0) {
      targetStatus = 'achieved'
      dailyNeeded  = 0
    } else {
      const needed = stats.remaining / daysLeft
      dailyNeeded  = Math.round(needed * 10) / 10
      targetStatus = needed > 8 ? 'unreachable' : 'on_track'
    }
  }

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
    daysLeft,
    dailyNeeded,
    targetStatus,
    punchStreak,
    maxPunchMonth: maxStreak,
    calendar,
    taskCounts,
    monthWorkHours,
    requiredWorkHours,
    workingDays,
    achievements:     achievementsRes.data ?? [],
    showcaseCodes:    member.showcase_codes ?? [],
    showNextLevelBtn: isCurrentMonth && day >= 25,
    line: {
      bound:       !!member.line_user_id,
      displayName: member.line_display_name ?? null,
      pictureUrl:  member.line_picture_url  ?? null,
    },
  })
}
