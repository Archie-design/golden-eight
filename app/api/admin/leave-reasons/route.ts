// ============================================================
// 後台請假事由管理（管理員）
// ============================================================
// GET    列出全部事由（含停用，供管理）
// POST   新增事由 { label }
// PATCH  切換 active { id, active }
// DELETE 移除事由 ?id=（已被 leave_records 引用者仍存 label 快照，不影響歷史）

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-helper'

export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const { data } = await db
    .from('leave_reasons').select('id, label, active, sort_order')
    .order('sort_order').order('id')
  return NextResponse.json({ ok: true, data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  let body: { label?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ ok: false, msg: '格式錯誤' }, { status: 400 })
  }
  const label = typeof body.label === 'string' ? body.label.trim() : ''
  if (!label || label.length > 20) {
    return NextResponse.json({ ok: false, msg: '事由需 1–20 字' }, { status: 400 })
  }

  const { error } = await db.from('leave_reasons').insert({ label, active: true })
  if (error) {
    console.error('[leave-reasons] insert failed', error.message)
    return NextResponse.json({ ok: false, msg: '新增失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, msg: `已新增事由「${label}」` })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  let body: { id?: number; active?: boolean }
  try { body = await request.json() } catch {
    return NextResponse.json({ ok: false, msg: '格式錯誤' }, { status: 400 })
  }
  if (typeof body.id !== 'number' || typeof body.active !== 'boolean') {
    return NextResponse.json({ ok: false, msg: '參數錯誤' }, { status: 400 })
  }

  const { error } = await db.from('leave_reasons')
    .update({ active: body.active }).eq('id', body.id)
  if (error) {
    console.error('[leave-reasons] patch failed', error.message)
    return NextResponse.json({ ok: false, msg: '更新失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, msg: body.active ? '已啟用' : '已停用' })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, msg: 'id 錯誤' }, { status: 400 })
  }
  const { error } = await db.from('leave_reasons').delete().eq('id', id)
  if (error) {
    console.error('[leave-reasons] delete failed', error.message)
    return NextResponse.json({ ok: false, msg: '移除失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, msg: '已移除事由' })
}
