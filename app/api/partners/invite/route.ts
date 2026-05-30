import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { parseBody, PartnerInviteSchema } from '@/lib/validation'
import { PARTNER_MAX, PARTNER_REJECT_COOLDOWN_DAYS } from '@/lib/constants'

/**
 * POST /api/partners/invite
 * Body: { targetId: string }
 *
 * 邀請流程驗證：
 *   • 不可邀請自己
 *   • target 必須存在且為「活躍」
 *   • 兩人之間不可有 pending（任一方向）
 *   • 兩人之間不可有 accepted（已是夥伴）
 *   • 若 target→me 有 rejected 在冷卻內 → 409
 *   • 若 me→target 有 rejected 在冷卻內 → 409
 *   • 我的 accepted 夥伴數 < PARTNER_MAX
 *   • target 的 accepted 夥伴數 < PARTNER_MAX
 */
export async function POST(req: NextRequest) {
  const auth = await getCurrentMember()
  if (auth instanceof NextResponse) return auth
  const { member, db } = auth

  const parsed = await parseBody(req, PartnerInviteSchema)
  if (parsed instanceof NextResponse) return parsed
  const { targetId } = parsed.data

  if (targetId === member.id) {
    return NextResponse.json({ ok: false, msg: '不可邀請自己' }, { status: 400 })
  }

  // 1. 確認 target 存在且活躍
  const { data: target } = await db
    .from('members').select('id, name, status').eq('id', targetId).maybeSingle()
  if (!target || (target as { status: string }).status !== '活躍') {
    return NextResponse.json({ ok: false, msg: '找不到此成員或已停用' }, { status: 404 })
  }

  // 2. 查 me ↔ target 既有關係（兩方向）
  const { data: existingRows } = await db
    .from('partner_requests')
    .select('id, requester_id, target_id, status, responded_at')
    .or(`and(requester_id.eq.${member.id},target_id.eq.${targetId}),and(requester_id.eq.${targetId},target_id.eq.${member.id})`)

  const existing = (existingRows ?? []) as {
    id: number; requester_id: string; target_id: string; status: string; responded_at: string | null
  }[]

  const cooldownMs = PARTNER_REJECT_COOLDOWN_DAYS * 86_400_000
  const now = Date.now()

  let rowToUpsert: { id: number } | null = null
  for (const r of existing) {
    if (r.status === 'accepted') {
      return NextResponse.json({ ok: false, msg: '你們已經是夥伴' }, { status: 409 })
    }
    if (r.status === 'pending') {
      const msg = r.requester_id === member.id
        ? '已送出邀請，等待對方回應'
        : '對方已邀請你，請至「邀請管理」處理'
      return NextResponse.json({ ok: false, msg }, { status: 409 })
    }
    // status === 'rejected'
    const respondedAt = r.responded_at ? Date.parse(r.responded_at) : 0
    if (now - respondedAt < cooldownMs) {
      const remain = Math.ceil((cooldownMs - (now - respondedAt)) / 86_400_000)
      return NextResponse.json(
        { ok: false, msg: `邀請冷卻中，${remain} 天後可重新邀請` },
        { status: 409 },
      )
    }
    // 過了冷卻 → 若是我發出的，等下 upsert 復用
    if (r.requester_id === member.id) rowToUpsert = { id: r.id }
  }

  // 3. 雙方 accepted 數量上限
  const [myCntRes, tgtCntRes] = await Promise.all([
    db.from('partner_requests').select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${member.id},target_id.eq.${member.id}`).eq('status', 'accepted'),
    db.from('partner_requests').select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${targetId},target_id.eq.${targetId}`).eq('status', 'accepted'),
  ])
  if ((myCntRes.count ?? 0) >= PARTNER_MAX) {
    return NextResponse.json({ ok: false, msg: `你已達夥伴上限 ${PARTNER_MAX} 人` }, { status: 409 })
  }
  if ((tgtCntRes.count ?? 0) >= PARTNER_MAX) {
    return NextResponse.json({ ok: false, msg: `對方夥伴已滿（${PARTNER_MAX} 人）` }, { status: 409 })
  }

  // 4. 插入或更新邀請
  if (rowToUpsert) {
    const { error } = await db.from('partner_requests')
      .update({ status: 'pending', requested_at: new Date().toISOString(), responded_at: null })
      .eq('id', rowToUpsert.id)
    if (error) {
      console.error('[partners/invite] update failed', error)
      return NextResponse.json({ ok: false, msg: '邀請失敗，請稍後再試' }, { status: 500 })
    }
  } else {
    const { error } = await db.from('partner_requests')
      .insert({ requester_id: member.id, target_id: targetId, status: 'pending' })
    if (error) {
      console.error('[partners/invite] insert failed', error)
      return NextResponse.json({ ok: false, msg: '邀請失敗，請稍後再試' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, msg: `已送出邀請給 ${(target as { name: string }).name}` })
}
