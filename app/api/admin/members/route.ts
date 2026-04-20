import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-helper'
import { AddMemberSchema, parseBody } from '@/lib/validation'

// 回傳給前端的會員欄位白名單（避免外洩 phone_full / phone_last3）
const MEMBER_COLUMNS = 'id, name, join_date, level, next_level, is_admin, status, line_display_name, line_picture_url, created_at'

export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const { data: members } = await db.from('members').select(MEMBER_COLUMNS).order('id')
  return NextResponse.json({ ok: true, members: members ?? [] })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const parsed = await parseBody(request, AddMemberSchema)
  if (parsed instanceof NextResponse) return parsed
  const { name, phone, joinDate, level } = parsed.data

  // 重複檢查（同姓名 + 同 phone_full）
  const { data: possible } = await db
    .from('members')
    .select('id, phone_full, phone_last3')
    .eq('name', name)

  const last3 = phone.slice(-3)
  const clash = (possible ?? []).some((m: { phone_full: string | null; phone_last3: string | null }) =>
    m.phone_full === phone || (!m.phone_full && m.phone_last3 === last3)
  )
  if (clash) {
    return NextResponse.json({ ok: false, msg: '此姓名與手機號已存在' }, { status: 409 })
  }

  const { data: idRow, error: idErr } = await db.rpc('next_member_id')
  if (idErr || !idRow) {
    console.error('[admin/members] next_member_id failed', idErr)
    return NextResponse.json({ ok: false, msg: '新增失敗，請稍後再試' }, { status: 500 })
  }

  const { error } = await db.from('members').insert({
    id:         idRow as string,
    name,
    phone_full: phone,
    join_date:  joinDate || new Date().toISOString().slice(0, 10),
    level,
  })

  if (error) {
    console.error('[admin/members] insert failed', error)
    return NextResponse.json({ ok: false, msg: '新增失敗，請稍後再試' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, msg: `已新增成員 ${name}` })
}
