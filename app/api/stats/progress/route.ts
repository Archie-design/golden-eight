import { NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats, calcMaxPunchStreakFromSorted, isDawnKing, calcPaceStatus } from '@/lib/scoring'
import { MEMBER_COLS_STATS, RECORD_COLS_STATS } from '@/lib/db-columns'
import type { Member, CheckInRecord } from '@/types'

export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const today      = getTodayTaipei()
  const currentYm  = today.substring(0, 7)
  const rawMonth   = new URL(req.url).searchParams.get('month') ?? ''
  const yearMonth  = /^\d{4}-\d{2}$/.test(rawMonth) && rawMonth <= currentYm
    ? rawMonth : currentYm
  const isCurrentMonth = yearMonth === currentYm
  // 歷史月份用月底為基準，使 calcMonthStats 分母涵蓋完整一個月
  const refDate = isCurrentMonth ? today : getMonthEnd(yearMonth)

  const { data: members } = await db.from('members').select(MEMBER_COLS_STATS).eq('status', '活躍').order('id')
  if (!members?.length) return NextResponse.json({ ok: true, yearMonth, rows: [] })

  const memberList = members as Member[]

  // 一次撈取所有成員當月紀錄 + 月結結果（若已月結）
  const [allRecsRes, summariesRes] = await Promise.all([
    db.from('checkin_records').select(RECORD_COLS_STATS)
      .in('member_id', memberList.map(m => m.id))
      .gte('date', yearMonth + '-01').lte('date', getMonthEnd(yearMonth))
      .order('date'),
    db.from('monthly_summary')
      .select('member_id, total_score, rate, passing, work_hours_deduction, penalty')
      .eq('year_month', yearMonth)
      .in('member_id', memberList.map(m => m.id)),
  ])

  const recsByMember: Record<string, CheckInRecord[]> = {}
  ;((allRecsRes.data ?? []) as CheckInRecord[]).forEach(r => {
    (recsByMember[r.member_id] ??= []).push(r)
  })

  type Summary = {
    member_id: string
    total_score: number
    rate: number
    passing: boolean
    work_hours_deduction: number
    penalty: number
  }
  const summaryByMember: Record<string, Summary> = {}
  ;((summariesRes.data ?? []) as Summary[]).forEach(s => {
    summaryByMember[s.member_id] = s
  })

  const rows = memberList.map(m => {
    const recs       = recsByMember[m.id] ?? []
    const stats      = calcMonthStats(m, recs, refDate)
    const maxStreak  = calcMaxPunchStreakFromSorted(recs)
    const dawnKing   = isDawnKing(m, recs, yearMonth, refDate)
    const summary    = summaryByMember[m.id]
    // 二維落隊偵測：僅本月現時視圖計算（歷史月看月結結果，pace/預估無意義）
    const paceStatus = isCurrentMonth ? calcPaceStatus(m, stats, refDate, yearMonth) : null
    return {
      id:         m.id,
      name:       m.name,
      level:      m.level,
      totalScore: stats.totalScore,
      maxScore:   stats.maxScore,
      rate:       stats.rate,
      passing:    stats.passing,
      maxStreak,
      isDawnKing: dawnKing,
      exempted:   stats.maxScore === 0,
      // 本月：pace（回顧）/ projRate（前瞻）/ quadrant（四象限）；歷史月為 null
      pace:       paceStatus ? paceStatus.pace : null,
      projRate:   paceStatus ? paceStatus.projRate : null,
      paceStatus: paceStatus ? paceStatus.quadrant : null,
      // 月結後欄位（未月結為 null）
      settledTotal:   summary?.total_score          ?? null,
      settledRate:    summary?.rate                 ?? null,
      settledPassing: summary?.passing              ?? null,
      whDeduction:    summary?.work_hours_deduction ?? null,
      penalty:        summary?.penalty              ?? null,
    }
  })

  return NextResponse.json({ ok: true, yearMonth, isCurrentMonth, currentYearMonth: currentYm, rows })
}
