import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload, getTodayTaipei } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const payload = await getTokenPayload()
  if (!payload?.isAdmin) return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })

  const db        = createServerClient()
  const ymParam   = new URL(req.url).searchParams.get('yearMonth')
  const yearMonth = ymParam && /^\d{4}-\d{2}$/.test(ymParam) ? ymParam : getTodayTaipei().substring(0, 7)

  const { data: rows } = await db
    .from('monthly_summary')
    .select('*, members(name, level)')
    .eq('year_month', yearMonth)
    .eq('passing', false)

  const total = (rows ?? []).reduce((s: number, r: { penalty: number }) => s + (r.penalty ?? 0), 0)

  const formatted = (rows ?? []).map((r: { members: { name: string; level: string }; rate: number; penalty: number }) => ({
    name:    r.members?.name,
    level:   r.members?.level,
    rate:    r.rate,
    penalty: r.penalty,
  }))

  return NextResponse.json({ ok: true, yearMonth, rows: formatted, total })
}
