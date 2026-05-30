import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

/**
 * DELETE /api/partners/[id]
 * 解除與成員 [id] 的夥伴關係（必須為 accepted 狀態）。
 * encouragements 歷史紀錄保留不刪。
 */
export async function DELETE(
  _req: NextRequest,
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
    return NextResponse.json({ ok: false, msg: '不可解除自己' }, { status: 400 })
  }

  // 找到雙方間的 accepted 關係（單向記錄，兩方向都查）
  const { data: rowsRaw } = await db
    .from('partner_requests')
    .select('id')
    .or(`and(requester_id.eq.${member.id},target_id.eq.${partnerId}),and(requester_id.eq.${partnerId},target_id.eq.${member.id})`)
    .eq('status', 'accepted')
  const rows = (rowsRaw ?? []) as { id: number }[]

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, msg: '找不到夥伴關係' }, { status: 404 })
  }

  // 應該只有一筆，但保險起見全部刪除
  const ids = rows.map(r => r.id)
  const { error } = await db.from('partner_requests').delete().in('id', ids)
  if (error) {
    console.error('[partners/DELETE] delete failed', error)
    return NextResponse.json({ ok: false, msg: '解除失敗，請稍後再試' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, msg: '已解除夥伴關係' })
}
