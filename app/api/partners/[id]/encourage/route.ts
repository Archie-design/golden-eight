import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember, getCheckinDayTaipei } from '@/lib/api-helper'
import { parseBody, PartnerEncourageSchema } from '@/lib/validation'
import { ENCOURAGE_MESSAGES } from '@/lib/constants'

/**
 * POST /api/partners/[id]/encourage
 * Body: { message: string }
 *
 * 對方必須是我的 accepted 夥伴；message 必須在 ENCOURAGE_MESSAGES 清單內；
 * 每對成員每日僅可一次（DB UNIQUE 約束）。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentMember()
  if (auth instanceof NextResponse) return auth
  const { member, db } = auth

  const { id: partnerId } = await params
  if (!/^M\d+$/.test(partnerId)) {
    return NextResponse.json({ ok: false, msg: '無效的成員 ID' }, { status: 400 })
  }
  if (partnerId === member.id) {
    return NextResponse.json({ ok: false, msg: '不可鼓勵自己' }, { status: 400 })
  }

  const parsed = await parseBody(req, PartnerEncourageSchema)
  if (parsed instanceof NextResponse) return parsed
  const { message } = parsed.data

  if (!(ENCOURAGE_MESSAGES as readonly string[]).includes(message)) {
    return NextResponse.json({ ok: false, msg: '請從預設訊息列表中選擇' }, { status: 400 })
  }

  // 確認是 accepted 夥伴
  const { data: relRaw } = await db
    .from('partner_requests')
    .select('id')
    .or(`and(requester_id.eq.${member.id},target_id.eq.${partnerId}),and(requester_id.eq.${partnerId},target_id.eq.${member.id})`)
    .eq('status', 'accepted')
    .maybeSingle()
  if (!relRaw) {
    return NextResponse.json({ ok: false, msg: '對方不是你的夥伴' }, { status: 403 })
  }

  const today = getCheckinDayTaipei()

  const { error } = await db.from('encouragements').insert({
    from_id: member.id,
    to_id:   partnerId,
    date:    today,
    message,
  })

  if (error) {
    // 23505: unique violation → 今日已鼓勵過
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: false, msg: '今日已鼓勵過此夥伴' }, { status: 409 })
    }
    console.error('[partners/encourage] insert failed', error)
    return NextResponse.json({ ok: false, msg: '送出失敗，請稍後再試' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, msg: '已送出鼓勵' })
}
