import { NextResponse } from 'next/server'
import { getCurrentMember, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats } from '@/lib/scoring'
import { MEMBER_COLS_STATS, RECORD_COLS_STATS } from '@/lib/db-columns'
import type { Member, CheckInRecord } from '@/types'

// GET /api/stats/history — last 6 months for current user + group average per month
export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  // Build list of last 6 year-month strings (newest first)
  const today = getTodayTaipei()
  const months: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(`${today}T00:00:00`)
    d.setMonth(d.getMonth() - i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  months.reverse()  // oldest → newest

  // Fetch all active members for group average (含 level / effective_start_date 以便 fallback 即時運算)
  const { data: allMembers } = await db
    .from('members').select(MEMBER_COLS_STATS).eq('status', '活躍')

  const memberList = (allMembers ?? []) as Member[]
  const allIds     = memberList.map(m => m.id)

  const [userRows, groupRows] = await Promise.all([
    db.from('monthly_summary')
      .select('year_month, rate, total_score, passing')
      .eq('member_id', member.id)
      .in('year_month', months)
      .order('year_month'),
    db.from('monthly_summary')
      .select('member_id, year_month, rate')
      .in('member_id', allIds)
      .in('year_month', months),
  ])

  // Index user rows by month
  const userByMonth: Record<string, { rate: number; totalScore: number; passing: boolean }> = {}
  ;(userRows.data ?? []).forEach((r: { year_month: string; rate: number; total_score: number; passing: boolean }) => {
    userByMonth[r.year_month] = { rate: r.rate, totalScore: r.total_score, passing: r.passing }
  })

  // Compute group average per month — 先記錄哪些 (member, ym) 已有 summary 以避免 fallback 重複加總
  const groupSums:   Record<string, { sum: number; count: number }> = {}
  const summaryDone: Record<string, Set<string>> = {}  // ym -> Set<member_id>
  ;(groupRows.data ?? []).forEach((r: { member_id: string; year_month: string; rate: number }) => {
    if (!groupSums[r.year_month])   groupSums[r.year_month]   = { sum: 0, count: 0 }
    if (!summaryDone[r.year_month]) summaryDone[r.year_month] = new Set()
    groupSums[r.year_month].sum   += r.rate
    groupSums[r.year_month].count += 1
    summaryDone[r.year_month].add(r.member_id)
  })

  // ── Fallback：未月結的月份從 checkin_records 即時運算 ─────────────────
  const currentYm        = today.substring(0, 7)
  const userMissingMonths  = months.filter(m => !userByMonth[m])
  const groupNeedFallback  = months.filter(m => (summaryDone[m]?.size ?? 0) < memberList.length)
  const fallbackMonths     = Array.from(new Set([...userMissingMonths, ...groupNeedFallback])).sort()

  if (fallbackMonths.length) {
    const earliest = fallbackMonths[0] + '-01'
    const latest   = getMonthEnd(fallbackMonths[fallbackMonths.length - 1])
    const idsToFetch = groupNeedFallback.length ? allIds : [member.id]

    const { data: liveRecs } = await db
      .from('checkin_records')
      .select('member_id, ' + RECORD_COLS_STATS)
      .in('member_id', idsToFetch)
      .gte('date', earliest).lte('date', latest)
      .order('date')

    // Group by (member_id, ym)
    const recsByMemberMonth: Record<string, Record<string, CheckInRecord[]>> = {}
    ;((liveRecs ?? []) as unknown as (CheckInRecord & { member_id: string })[]).forEach(r => {
      const ym = r.date.substring(0, 7)
      if (!recsByMemberMonth[r.member_id]) recsByMemberMonth[r.member_id] = {}
      ;(recsByMemberMonth[r.member_id][ym] ??= []).push(r)
    })

    // 自己的缺月
    for (const ym of userMissingMonths) {
      const recs = recsByMemberMonth[member.id]?.[ym] ?? []
      if (!recs.length) continue
      const refDate = ym === currentYm ? today : getMonthEnd(ym)
      const stats   = calcMonthStats(member, recs, refDate)
      userByMonth[ym] = { rate: stats.rate, totalScore: stats.totalScore, passing: stats.passing }
    }

    // 群組平均缺月
    for (const ym of groupNeedFallback) {
      const refDate = ym === currentYm ? today : getMonthEnd(ym)
      for (const m of memberList) {
        if (summaryDone[ym]?.has(m.id)) continue  // 已有 summary，避免重複加總
        const recs = recsByMemberMonth[m.id]?.[ym] ?? []
        if (!recs.length) continue
        const stats = calcMonthStats(m, recs, refDate)
        if (!groupSums[ym]) groupSums[ym] = { sum: 0, count: 0 }
        groupSums[ym].sum   += stats.rate
        groupSums[ym].count += 1
      }
    }
  }

  const history = months.map(ym => ({
    yearMonth:  ym,
    rate:       userByMonth[ym]?.rate        ?? null,
    totalScore: userByMonth[ym]?.totalScore  ?? null,
    passing:    userByMonth[ym]?.passing     ?? null,
    groupAvg:   groupSums[ym]
      ? Math.round(groupSums[ym].sum / groupSums[ym].count)
      : null,
  }))

  return NextResponse.json({ ok: true, history })
}
