import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-helper'

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const { id } = await params
  const { error } = await db.from('members').update({ status: '停用' }).eq('id', id)
  if (error) {
    console.error('[admin/members/id] update failed', error)
    return NextResponse.json({ ok: false, msg: '停用失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, msg: '已停用成員' })
}
