// ============================================================
// 請假（學員自行，誠信原則）
// ============================================================
//
// POST：針對某邏輯日請假。防濫用限制：
//   - date 必須 ≥ 今日邏輯日（不能追認過去/已漏卡日 → 擋「月底看苗頭補請假」）
//   - date 所屬月未月結（monthly_summary 無該成員該月列）
//   - reason 必須是 active 的後台事由（存 label 快照）
// DELETE：僅能取消 date ≥ 今日的請假（與 POST 對稱，過去凍結）。
//
// 請假日由計分分母移除（分子分母皆移）——實際扣減在各分母呼叫點透過 fetchLeaveDates 完成。

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember, getCheckinDayTaipei } from '@/lib/api-helper'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

/** 該成員該月是否已月結（monthly_summary 有列即已結） */
async function isMonthSettled(
  db: ReturnType<typeof import('@/lib/supabase/server').createServerClient>,
  memberId: string,
  yearMonth: string,
): Promise<boolean> {
  const { data } = await db
    .from('monthly_summary').select('id')
    .eq('member_id', memberId).eq('year_month', yearMonth).maybeSingle()
  return !!data
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`leave:${getClientIp(request)}`, 20, 60_000)
  if (rl) return rl

  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  let body: { date?: string; reason?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ ok: false, msg: '格式錯誤' }, { status: 400 })
  }
  const date   = typeof body.date === 'string' ? body.date : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, msg: '日期格式錯誤' }, { status: 400 })
  }

  // ── 只能請今日或未來（擋事後追認過去/漏卡日）─────────────────────────
  const todayLogical = getCheckinDayTaipei()
  if (date < todayLogical) {
    return NextResponse.json({ ok: false, msg: '只能請今日或未來的假，不能追認過去' }, { status: 400 })
  }

  // ── 該月未月結 ────────────────────────────────────────────────────────
  const ym = date.substring(0, 7)
  if (await isMonthSettled(db, member.id, ym)) {
    return NextResponse.json({ ok: false, msg: '該月已結算，無法請假' }, { status: 409 })
  }

  // ── reason 必須是 active 事由（存 label 快照）───────────────────────────
  const { data: reasonRow } = await db
    .from('leave_reasons').select('label')
    .eq('label', reason).eq('active', true).maybeSingle()
  if (!reasonRow) {
    return NextResponse.json({ ok: false, msg: '請選擇有效的請假事由' }, { status: 400 })
  }

  // ── upsert（一日一筆，重複請假視為已請）────────────────────────────────
  const { error } = await db.from('leave_records').upsert(
    { member_id: member.id, date, reason },
    { onConflict: 'member_id,date' },
  )
  if (error) {
    console.error('[leave] upsert failed', error.message)
    return NextResponse.json({ ok: false, msg: '請假失敗，請再試一次' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, msg: `已為 ${date} 請假（${reason}）` })
}

export async function DELETE(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const date = new URL(request.url).searchParams.get('date') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, msg: '日期格式錯誤' }, { status: 400 })
  }
  // 僅能取消今日或未來（過去請假凍結，與 POST 對稱）
  if (date < getCheckinDayTaipei()) {
    return NextResponse.json({ ok: false, msg: '已過去的請假無法取消' }, { status: 400 })
  }

  const { error } = await db.from('leave_records')
    .delete().eq('member_id', member.id).eq('date', date)
  if (error) {
    console.error('[leave] delete failed', error.message)
    return NextResponse.json({ ok: false, msg: '取消失敗，請再試一次' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, msg: '已取消請假，該日恢復計分' })
}
