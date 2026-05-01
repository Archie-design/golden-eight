import { NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats, calcMaxPunchStreakFromSorted } from '@/lib/scoring'
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

  // 一次撈取所有成員當月紀錄，避免 per-member N+1
  const { data: allRecs } = await db
    .from('checkin_records').select(RECORD_COLS_STATS)
    .in('member_id', memberList.map(m => m.id))
    .gte('date', yearMonth + '-01').lte('date', getMonthEnd(yearMonth))
    .order('date')

  const recsByMember: Record<string, CheckInRecord[]> = {}
  ;((allRecs ?? []) as CheckInRecord[]).forEach(r => {
    (recsByMember[r.member_id] ??= []).push(r)
  })

  const rows = memberList.map(m => {
    const recs       = recsByMember[m.id] ?? []
    const stats      = calcMonthStats(m, recs, refDate)
    const maxStreak  = calcMaxPunchStreakFromSorted(recs)
    const isDawnKing = recs.length > 0 && recs.every(r => r.tasks[1])
    return {
      id:         m.id,
      name:       m.name,
      level:      m.level,
      totalScore: stats.totalScore,
      maxScore:   stats.maxScore,
      rate:       stats.rate,
      passing:    stats.passing,
      maxStreak,
      isDawnKing,
    }
  })

  return NextResponse.json({ ok: true, yearMonth, isCurrentMonth, currentYearMonth: currentYm, rows })
}
