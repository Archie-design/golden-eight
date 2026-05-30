import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { parseBody, PartnerInvitationActionSchema } from '@/lib/validation'
import { PARTNER_MAX } from '@/lib/constants'
import { awardOnAccept } from '@/lib/partner-achievements'

/**
 * PATCH /api/partners/invitations/[id]
 * Body: { action: 'accept' | 'reject' }
 *
 * 只有邀請的 target_id（被邀請方）可以操作。
 * accept 時雙方 accepted 數量均需 < PARTNER_MAX。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentMember()
  if (auth instanceof NextResponse) return auth
  const { member, db } = auth

  const { id } = await params
  const invitationId = Number(id)
  if (!Number.isFinite(invitationId) || invitationId <= 0) {
    return NextResponse.json({ ok: false, msg: '無效的邀請 ID' }, { status: 400 })
  }

  const parsed = await parseBody(req, PartnerInvitationActionSchema)
  if (parsed instanceof NextResponse) return parsed
  const { action } = parsed.data

  // 1. 取得邀請
  const { data: rowRaw } = await db
    .from('partner_requests')
    .select('id, requester_id, target_id, status')
    .eq('id', invitationId)
    .maybeSingle()
  const row = rowRaw as { id: number; requester_id: string; target_id: string; status: string } | null
  if (!row) {
    return NextResponse.json({ ok: false, msg: '找不到此邀請' }, { status: 404 })
  }
  if (row.target_id !== member.id) {
    return NextResponse.json({ ok: false, msg: '只能由被邀請方回應' }, { status: 403 })
  }
  if (row.status !== 'pending') {
    return NextResponse.json({ ok: false, msg: '此邀請已處理過' }, { status: 409 })
  }

  // 2. accept 時驗證雙方上限
  if (action === 'accept') {
    const [myCntRes, otherCntRes] = await Promise.all([
      db.from('partner_requests').select('id', { count: 'exact', head: true })
        .or(`requester_id.eq.${member.id},target_id.eq.${member.id}`).eq('status', 'accepted'),
      db.from('partner_requests').select('id', { count: 'exact', head: true })
        .or(`requester_id.eq.${row.requester_id},target_id.eq.${row.requester_id}`).eq('status', 'accepted'),
    ])
    if ((myCntRes.count ?? 0) >= PARTNER_MAX) {
      return NextResponse.json({ ok: false, msg: `你已達夥伴上限 ${PARTNER_MAX} 人` }, { status: 409 })
    }
    if ((otherCntRes.count ?? 0) >= PARTNER_MAX) {
      return NextResponse.json({ ok: false, msg: `對方夥伴已滿（${PARTNER_MAX} 人）` }, { status: 409 })
    }
  }

  // 3. 更新狀態
  const newStatus = action === 'accept' ? 'accepted' : 'rejected'
  const { error } = await db.from('partner_requests')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('id', invitationId)
  if (error) {
    console.error('[partners/invitations/PATCH] update failed', error)
    return NextResponse.json({ ok: false, msg: '操作失敗，請稍後再試' }, { status: 500 })
  }

  // accept 後觸發雙方社交類成就（PARTNER_FIRST/3/5）；回傳我這側新解鎖的供前端 popup
  let newAchievements: { code: string; name: string; badge: string }[] = []
  if (action === 'accept') {
    newAchievements = await awardOnAccept(db, member.id, row.requester_id)
  }

  return NextResponse.json({
    ok:  true,
    msg: action === 'accept' ? '已接受邀請' : '已拒絕邀請',
    newAchievements,
  })
}

/**
 * DELETE /api/partners/invitations/[id]
 * 取消尚未回應的邀請。只有邀請者（requester）可以取消，且必須是 pending 狀態。
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentMember()
  if (auth instanceof NextResponse) return auth
  const { member, db } = auth

  const { id } = await params
  const invitationId = Number(id)
  if (!Number.isFinite(invitationId) || invitationId <= 0) {
    return NextResponse.json({ ok: false, msg: '無效的邀請 ID' }, { status: 400 })
  }

  const { data: rowRaw } = await db
    .from('partner_requests')
    .select('id, requester_id, status')
    .eq('id', invitationId)
    .maybeSingle()
  const row = rowRaw as { id: number; requester_id: string; status: string } | null
  if (!row) {
    return NextResponse.json({ ok: false, msg: '找不到此邀請' }, { status: 404 })
  }
  if (row.requester_id !== member.id) {
    return NextResponse.json({ ok: false, msg: '只能取消自己發出的邀請' }, { status: 403 })
  }
  if (row.status !== 'pending') {
    return NextResponse.json({ ok: false, msg: '此邀請已處理過' }, { status: 409 })
  }

  const { error } = await db.from('partner_requests').delete().eq('id', invitationId)
  if (error) {
    console.error('[partners/invitations/DELETE] failed', error)
    return NextResponse.json({ ok: false, msg: '取消失敗，請稍後再試' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, msg: '已取消邀請' })
}
