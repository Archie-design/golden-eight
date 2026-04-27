import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-helper'

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
    .select('id, name, token_version')
    .eq('id', id)
    .eq('status', '活躍')
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ ok: false, msg: '找不到此成員或已停用' }, { status: 404 })
  }

  const tv = (member.token_version ?? 0) + 1
  const { error } = await db.from('members').update({
    password_hash:   null,
    token_version:   tv,
    failed_attempts: 0,
    locked_until:    null,
  }).eq('id', id)

  if (error) {
    console.error('[admin/reset-password] update failed', error)
    return NextResponse.json({ ok: false, msg: '重置失敗，請稍後再試' }, { status: 500 })
  }

  return NextResponse.json({
    ok:  true,
    msg: `已重置 ${member.name} 的密碼，請通知該成員重新登入並設定新密碼`,
  })
}
