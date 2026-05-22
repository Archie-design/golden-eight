import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-helper'
import { hashPhone } from '@/lib/phone'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const { id } = await params

  const { data: member } = await db
    .from('members')
    .select('id, name, token_version, phone_hash, phone_full')
    .eq('id', id)
    .eq('status', '活躍')
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ ok: false, msg: '找不到此成員或已停用' }, { status: 404 })
  }

  const tv = (member.token_version ?? 0) + 1
  const updates: Record<string, unknown> = {
    password_hash:   null,
    token_version:   tv,
    failed_attempts: 0,
    locked_until:    null,
  }

  // 舊資料遷移漏網之魚：phone_hash 缺失但 phone_full 還在 → 順便補齊，
  // 否則 login route（第 48 行的 phone_hash !== null 條件）會永遠 miss，
  // 即使密碼重置成功，使用者也無法登入。
  let backfilled = false
  if (!member.phone_hash && member.phone_full) {
    updates.phone_hash = hashPhone(member.phone_full)
    backfilled = true
  }

  const { error } = await db.from('members').update(updates).eq('id', id)

  if (error) {
    console.error('[admin/reset-password] update failed', error)
    return NextResponse.json({ ok: false, msg: '重置失敗，請稍後再試' }, { status: 500 })
  }

  const msg = backfilled
    ? `已重置 ${member.name} 的密碼並補齊登入識別資料，請通知該成員重新登入並設定新密碼`
    : `已重置 ${member.name} 的密碼，請通知該成員重新登入並設定新密碼`

  return NextResponse.json({ ok: true, msg })
}
