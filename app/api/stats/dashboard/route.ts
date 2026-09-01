import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats, recommendLevel } from '@/lib/scoring'
import { fetchLeaveDates } from '@/lib/leave'
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
    db.from('checkin_records').select(RECORD_COLS_STATS + ', sunrise_photo_path, run_minutes, run_km')
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

  const monthRecs = (monthRecsRes.data ?? []) as unknown as CheckInRecord[]
  // 請假日從分母移除
  const leaveByMember = await fetchLeaveDates(db, [member.id], yearMonth)
  const leaveDates    = leaveByMember[member.id]
  const stats     = calcMonthStats(member, monthRecs, refDate, leaveDates)
  // 跨月感知：取當月紀錄裡 punch_streak 欄位的最大值（欄位本身已累積跨月計數）
  const maxStreak = monthRecs
    .filter(r => r.tasks[1])
    .reduce((m, r) => Math.max(m, (r as CheckInRecord & { punch_streak?: number }).punch_streak ?? 0), 0)

  const daysInMonth = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0).getDate()
  const calendar = Array.from({ length: daysInMonth }, (_, i) => {
    const d    = `${yearMonth}-${String(i + 1).padStart(2, '0')}`
    const rec  = monthRecs.find(r => r.date === d)
    const score = rec ? rec.total_score : null
    // 日曆 hover 顯自己當日日出照（我的日曆）；無照為 null
    const photoPath = (rec as (CheckInRecord & { sunrise_photo_path?: string | null }) | undefined)?.sunrise_photo_path
    const sunrisePhotoUrl = photoPath
      ? db.storage.from('sunrise-photos').getPublicUrl(photoPath).data.publicUrl
      : null
    return { date: d, day: i + 1, score, color: getCalendarColor(score), note: rec?.note ?? '', sunrisePhotoUrl }
  })

  const taskCounts = Array.from({ length: 8 }, (_, i) => monthRecs.filter(r => r.tasks[i]).length)

  const monthWorkHours    = monthRecs.reduce((s, r) => s + ((r as CheckInRecord & { work_hours?: number | null }).work_hours ?? 0), 0)
  const requiredWorkHours = workingDays * 8

  // 本月慢跑累積：總分鐘、總公里（2 位小數）、有跑天數（有填任一慢跑欄）
  type RunRec = CheckInRecord & { run_minutes?: number | null; run_km?: number | null }
  const runLog = monthRecs.reduce(
    (acc, r) => {
      const rr = r as RunRec
      const mins = rr.run_minutes ?? 0
      const km   = rr.run_km ?? 0
      const has  = rr.run_minutes != null || rr.run_km != null
      return { sumMinutes: acc.sumMinutes + mins, sumKm: acc.sumKm + km, runDays: acc.runDays + (has ? 1 : 0) }
    },
    { sumMinutes: 0, sumKm: 0, runDays: 0 },
  )
  runLog.sumKm = Number(runLog.sumKm.toFixed(2))   // 浮點加總規範

  // 下月階梯推薦：依「上月」（相對當前月的前一個已月結月）完成率
  // 上月字串以日期運算推導，正確跨年（1 月看去年 12 月）
  const [cy, cm] = currentYearMonth.split('-').map(Number)
  const prevMonthDate = new Date(Date.UTC(cy, cm - 2, 1))   // cm-2：JS 月份 0-based 再退一月
  const prevYm = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`
  const { data: prevSummary } = await db
    .from('monthly_summary')
    .select('rate, max_score')
    .eq('member_id', member.id).eq('year_month', prevYm)
    .maybeSingle()
  const prevRate     = (prevSummary as { rate?: number } | null)?.rate ?? null
  const prevMaxScore = (prevSummary as { max_score?: number } | null)?.max_score ?? 0
  const rec = recommendLevel(prevRate, prevMaxScore)
  const levelRecommendation = rec.level
    ? { level: rec.level, lastMonthRate: prevRate }
    : null

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
    runLog,
    workingDays,
    achievements:     achievementsRes.data ?? [],
    showcaseCodes:    member.showcase_codes ?? [],
    showNextLevelBtn: isCurrentMonth && day >= 25,
    levelRecommendation,   // { level, lastMonthRate } | null（無上月資料/豁免為 null）
    line: {
      bound:       !!member.line_user_id,
      displayName: member.line_display_name ?? null,
      pictureUrl:  member.line_picture_url  ?? null,
    },
  })
}
