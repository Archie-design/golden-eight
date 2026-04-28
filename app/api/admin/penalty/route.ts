import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei } from '@/lib/api-helper'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const ymParam   = new URL(req.url).searchParams.get('yearMonth')
  const yearMonth = ymParam && /^\d{4}-\d{2}$/.test(ymParam) ? ymParam : getTodayTaipei().substring(0, 7)

  const { data: rows } = await db
    .from('monthly_summary')
    .select('rate, penalty, members(name, level)')
    .eq('year_month', yearMonth)
    .eq('passing', false)

  type Row = { rate: number; penalty: number; members: { name: string; level: string } | null }
  const typedRows = (rows ?? []) as unknown as Row[]

  const total = typedRows.reduce((s, r) => s + (r.penalty ?? 0), 0)

  const formatted = typedRows.map(r => ({
    name:    r.members?.name,
    level:   r.members?.level,
    rate:    r.rate,
    penalty: r.penalty,
  }))

  return NextResponse.json({ ok: true, yearMonth, rows: formatted, total })
}
