import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats } from '@/lib/scoring'
import { MEMBER_COLS_STATS, RECORD_COLS_STATS } from '@/lib/db-columns'
import type { Member, CheckInRecord } from '@/types'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const ymParam   = new URL(req.url).searchParams.get('yearMonth')
  const yearMonth = ymParam && /^\d{4}-\d{2}$/.test(ymParam) ? ymParam : getTodayTaipei().substring(0, 7)

  const { data: rows } = await db
    .from('monthly_summary')
    .select('member_id, total_score, rate, penalty, work_hours_deduction, level, members(id, name, level)')
    .eq('year_month', yearMonth)
    .eq('passing', false)

  type Row = {
    member_id: string
    total_score: number
    rate: number
    penalty: number
    work_hours_deduction: number
    level: string | null   // 當月階梯快照
    members: { id: string; name: string; level: string } | null
  }
  const typedRows = (rows ?? []) as unknown as Row[]

  // 為了顯示「扣前 live 達成率」對照，撈當月所有相關成員紀錄並即時算 calcMonthStats
  const today      = getTodayTaipei()
  const isCurMonth = yearMonth === today.substring(0, 7)
  const refDate    = isCurMonth ? today : getMonthEnd(yearMonth)
  const memberIds  = typedRows.map(r => r.member_id).filter(Boolean)

  const liveByMember: Record<string, { rate: number; total: number }> = {}
  if (memberIds.length) {
    const [memRes, recRes] = await Promise.all([
      db.from('members').select(MEMBER_COLS_STATS).in('id', memberIds),
      db.from('checkin_records').select(RECORD_COLS_STATS)
        .in('member_id', memberIds)
        .gte('date', yearMonth + '-01').lte('date', getMonthEnd(yearMonth))
        .order('date'),
    ])
    const memList = (memRes.data ?? []) as Member[]
    const recsByMember: Record<string, CheckInRecord[]> = {}
    ;((recRes.data ?? []) as CheckInRecord[]).forEach(r => {
      (recsByMember[r.member_id] ??= []).push(r)
    })
    for (const m of memList) {
      const stats = calcMonthStats(m, recsByMember[m.id] ?? [], refDate)
      liveByMember[m.id] = { rate: stats.rate, total: stats.totalScore }
    }
  }

  const total = typedRows.reduce((s, r) => s + (r.penalty ?? 0), 0)

  const formatted = typedRows.map(r => {
    const live = r.member_id ? liveByMember[r.member_id] : undefined
    return {
      name:        r.members?.name,
      // 顯示當月階梯快照；缺快照的舊列 fallback 到現在的 level
      level:       r.level ?? r.members?.level,
      rate:        r.rate,
      penalty:     r.penalty,
      // 新增：扣前對照
      liveRate:    live?.rate  ?? null,
      liveTotal:   live?.total ?? null,
      whDeduction: r.work_hours_deduction ?? 0,
      settledTotal: r.total_score,
    }
  })

  return NextResponse.json({ ok: true, yearMonth, rows: formatted, total })
}
