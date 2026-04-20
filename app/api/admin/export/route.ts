import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei } from '@/lib/api-helper'
import { csvRow } from '@/lib/csv'

// GET /api/admin/export?yearMonth=YYYY-MM  → text/csv
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const ymParam   = new URL(req.url).searchParams.get('yearMonth')
  const yearMonth = ymParam && /^\d{4}-\d{2}$/.test(ymParam) ? ymParam : getTodayTaipei().substring(0, 7)

  const { data: summaries } = await db
    .from('monthly_summary')
    .select('*, members(id, name, level)')
    .eq('year_month', yearMonth)
    .order('member_id')

  type SummaryRow = {
    members: { id: string; name: string; level: string }
    total_score: number
    max_score: number
    rate: number
    passing: boolean
    penalty: number
    max_streak: number
    is_dawn_king: boolean
  }

  const rows: SummaryRow[] = summaries ?? []

  // P1-5：以 csvField 逐欄跳脫，阻擋公式注入（=/+/-/@）及逗號/引號。
  const header = ['成員編號', '姓名', '階梯', '總分', '滿分', '達成率(%)', '通過', '罰款(NT$)', '最長連打', '打拳王']
  const lines  = [
    csvRow(header),
    ...rows.map(r => csvRow([
      r.members?.id    ?? '',
      r.members?.name  ?? '',
      r.members?.level ?? '',
      r.total_score,
      r.max_score,
      r.rate,
      r.passing ? '是' : '否',
      r.penalty,
      r.max_streak,
      r.is_dawn_king ? '是' : '否',
    ])),
  ]

  const csv = '\uFEFF' + lines.join('\r\n')  // UTF-8 BOM for Excel compatibility

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="golden-eight-${yearMonth}.csv"`,
    },
  })
}
