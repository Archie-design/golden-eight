import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getMonthEnd } from '@/lib/api-helper'
import { RECORD_COLS_STATS } from '@/lib/db-columns'
import { TASKS } from '@/lib/constants'
import { csvRow } from '@/lib/csv'
import type { CheckInRecord } from '@/types'

// GET /api/admin/export-records?startMonth=YYYY-MM&endMonth=YYYY-MM  → text/csv
// 全員跨月份逐日打卡明細匯出（與 /api/admin/export 的月結摘要互補，非取代）。
// 不帶 startMonth/endMonth 時匯出全部歷史。
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const params     = new URL(req.url).searchParams
  const startMonth = params.get('startMonth')
  const endMonth   = params.get('endMonth')

  const validStart = startMonth && /^\d{4}-\d{2}$/.test(startMonth) ? startMonth : null
  const validEnd   = endMonth && /^\d{4}-\d{2}$/.test(endMonth) ? endMonth : null

  let query = db.from('checkin_records')
    .select(RECORD_COLS_STATS + ', run_minutes, run_km')
    .order('member_id')
    .order('date')

  if (validStart) query = query.gte('date', validStart + '-01')
  if (validEnd)   query = query.lte('date', getMonthEnd(validEnd))

  const { data: recsData } = await query
  const records = (recsData ?? []) as unknown as CheckInRecord[]

  // 批次查成員姓名（只查出現過的 member_id，記憶體 join）
  const memberIds = [...new Set(records.map(r => r.member_id))]
  const { data: membersData } = memberIds.length
    ? await db.from('members').select('id, name').in('id', memberIds)
    : { data: [] }
  const nameById: Record<string, string> = {}
  ;((membersData ?? []) as { id: string; name: string }[]).forEach(m => { nameById[m.id] = m.name })

  const header = [
    '成員編號', '姓名', '日期',
    ...TASKS.map(t => t.name),
    'base_score', 'punch_bonus', 'total_score', 'punch_streak',
    'work_hours', 'note', 'run_minutes', 'run_km', 'submit_time',
  ]
  const lines = [
    csvRow(header),
    ...records.map(r => {
      const rr = r as CheckInRecord & { run_minutes?: number | null; run_km?: number | null }
      return csvRow([
        r.member_id,
        nameById[r.member_id] ?? '',
        r.date,
        ...r.tasks.map(done => (done ? '是' : '否')),
        r.base_score,
        r.punch_bonus,
        r.total_score,
        r.punch_streak,
        r.work_hours ?? '',
        r.note ?? '',
        rr.run_minutes ?? '',
        rr.run_km ?? '',
        r.submit_time,
      ])
    }),
  ]

  const csv = '﻿' + lines.join('\r\n')   // UTF-8 BOM for Excel compatibility

  const rangeLabel = validStart || validEnd ? `${validStart ?? 'all'}_${validEnd ?? 'all'}` : 'all'

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="golden-eight-records-${rangeLabel}.csv"`,
    },
  })
}
