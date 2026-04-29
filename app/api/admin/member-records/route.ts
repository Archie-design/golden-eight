import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { RECORD_COLS_STATS } from '@/lib/db-columns'
import type { CheckInRecord } from '@/types'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const params     = new URL(req.url).searchParams
  const memberId   = params.get('memberId')
  const yearMonth  = params.get('yearMonth') ?? getTodayTaipei().substring(0, 7)

  if (!memberId || !/^M\d+$/.test(memberId)) {
    return NextResponse.json({ ok: false, msg: '缺少 memberId' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ ok: false, msg: 'yearMonth 格式錯誤' }, { status: 400 })
  }

  const { data: memberRow } = await db
    .from('members')
    .select('id, name, level, effective_start_date, join_date')
    .eq('id', memberId)
    .single()

  if (!memberRow) {
    return NextResponse.json({ ok: false, msg: '找不到成員' }, { status: 404 })
  }

  const effectiveStart = memberRow.effective_start_date ?? memberRow.join_date
  const monthStart     = yearMonth + '-01'
  const monthEnd       = getMonthEnd(yearMonth)
  const rangeStart     = effectiveStart > monthStart ? effectiveStart : monthStart

  const { data: recs } = await db
    .from('checkin_records')
    .select(RECORD_COLS_STATS)
    .eq('member_id', memberId)
    .gte('date', rangeStart)
    .lte('date', monthEnd)
    .order('date')

  return NextResponse.json({
    ok: true,
    member: {
      id:             memberRow.id,
      name:           memberRow.name,
      level:          memberRow.level,
      effectiveStart,
    },
    yearMonth,
    records: (recs ?? []) as CheckInRecord[],
  })
}
