import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getTokenPayload()
  if (!payload?.isAdmin) return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })

  const { id } = await params
  const db = createServerClient()
  const { error } = await db.from('members').update({ status: '停用' }).eq('id', id)
  if (error) return NextResponse.json({ ok: false, msg: '停用失敗' }, { status: 500 })
  return NextResponse.json({ ok: true, msg: '已停用成員' })
}
