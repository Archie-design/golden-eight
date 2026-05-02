import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei } from '@/lib/api-helper'

/**
 * GET /api/admin/unselected-next-level?yearMonth=YYYY-MM
 *
 * 列出指定月份未選下月階梯的成員（依 monthly_summary.chose_next_level = false 查詢）。
 * yearMonth 缺省為「最近一個已月結月份」。
 * 未月結月份回傳 { ok: true, rows: [], notSettled: true }。
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const ymParam = new URL(req.url).searchParams.get('yearMonth')
  let yearMonth = ymParam && /^\d{4}-\d{2}$/.test(ymParam) ? ymParam : ''

  // 缺省取最近一個已月結月份
  if (!yearMonth) {
    const { data } = await db
      .from('monthly_summary')
      .select('year_month')
      .order('year_month', { ascending: false })
      .limit(1)
    const latest = (data ?? [])[0] as { year_month: string } | undefined
    yearMonth = latest?.year_month ?? getTodayTaipei().substring(0, 7)
  }

  // 查該月所有月結列；若該月無任何記錄 → 視為未月結
  const { data: summaryRows, error } = await db
    .from('monthly_summary')
    .select('member_id, max_score, rate, passing, chose_next_level, members(id, name, level, join_date, status)')
    .eq('year_month', yearMonth)

  if (error) {
    console.error('[unselected-next-level] query failed', error)
    return NextResponse.json({ ok: false, msg: '查詢失敗' }, { status: 500 })
  }

  type Row = {
    member_id:        string
    max_score:        number
    rate:             number
    passing:          boolean
    chose_next_level: boolean
    members: { id: string; name: string; level: string; join_date: string; status: string } | null
  }
  const rows = (summaryRows ?? []) as unknown as Row[]

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, yearMonth, rows: [], notSettled: true })
  }

  const filtered = rows
    .filter(r => r.chose_next_level === false)
    .filter(r => r.members && r.members.status !== '停用')
    .map(r => ({
      id:           r.members!.id,
      name:         r.members!.name,
      level:        r.members!.level,
      joinDate:     r.members!.join_date,
      exempted:     r.max_score === 0,
      monthRate:    r.rate,
      monthPassing: r.passing,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))

  return NextResponse.json({ ok: true, yearMonth, rows: filtered, notSettled: false })
}
