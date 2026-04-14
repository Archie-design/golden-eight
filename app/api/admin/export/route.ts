import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload, getTodayTaipei } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/admin/export?yearMonth=YYYY-MM  → text/csv
export async function GET(req: NextRequest) {
  const payload = await getTokenPayload()
  if (!payload?.isAdmin) return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })

  const ymParam   = new URL(req.url).searchParams.get('yearMonth')
  const yearMonth = ymParam && /^\d{4}-\d{2}$/.test(ymParam) ? ymParam : getTodayTaipei().substring(0, 7)

  const db = createServerClient()

  const { data: summaries } = await db
    .from('monthly_summary')
    .select('*, members(name, level, phone_last3)')
    .eq('year_month', yearMonth)
    .order('member_id')

  type SummaryRow = {
    members: { name: string; level: string; phone_last3: string }
    total_score: number
    max_score: number
    rate: number
    passing: boolean
    penalty: number
    max_streak: number
    is_dawn_king: boolean
  }

  const rows: SummaryRow[] = summaries ?? []

  const header = ['姓名', '階梯', '手機末三碼', '總分', '滿分', '達成率(%)', '通過', '罰款(NT$)', '最長連打', '打拳王']
  const lines  = [
    header.join(','),
    ...rows.map(r => [
      r.members?.name       ?? '',
      r.members?.level      ?? '',
      r.members?.phone_last3 ?? '',
      r.total_score,
      r.max_score,
      r.rate,
      r.passing ? '是' : '否',
      r.penalty,
      r.max_streak,
      r.is_dawn_king ? '是' : '否',
    ].join(',')),
  ]

  const csv = '\uFEFF' + lines.join('\r\n')  // UTF-8 BOM for Excel compatibility

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="golden-eight-${yearMonth}.csv"`,
    },
  })
}
