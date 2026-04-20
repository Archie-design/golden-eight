import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createToken } from '@/lib/auth'
import { RegisterSchema, parseBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, RegisterSchema)
  if (parsed instanceof NextResponse) return parsed
  const { name, phone, joinDate, level } = parsed.data

  const db = createServerClient()

  // 檢查重複：以 phone_full 為主，同時擋掉舊資料 phone_last3 末三碼相符者
  const last3 = phone.slice(-3)
  const { data: possible } = await db
    .from('members')
    .select('id, name, phone_full, phone_last3')
    .eq('name', name)

  const clash = (possible ?? []).some((m: { phone_full: string | null; phone_last3: string | null }) =>
    m.phone_full === phone || (!m.phone_full && m.phone_last3 === last3)
  )
  if (clash) {
    return NextResponse.json({ ok: false, msg: '此姓名與手機號已存在，請直接登入' }, { status: 409 })
  }

  // 由 DB function 原子產生會員 ID，避免 count+1 的 race
  const { data: idRow, error: idErr } = await db.rpc('next_member_id')
  if (idErr || !idRow) {
    console.error('[register] next_member_id failed', idErr)
    return NextResponse.json({ ok: false, msg: '註冊失敗，請稍後再試' }, { status: 500 })
  }
  const newId = idRow as string

  const { data: member, error } = await db
    .from('members')
    .insert({
      id:         newId,
      name,
      phone_full: phone,
      join_date:  joinDate || new Date().toISOString().slice(0, 10),
      level,
    })
    .select('id, name, level, is_admin')
    .single()

  if (error || !member) {
    console.error('[register] insert failed', error)
    return NextResponse.json({ ok: false, msg: '註冊失敗，請稍後再試' }, { status: 500 })
  }

  const token = await createToken({ sub: member.id, isAdmin: false })
  const response = NextResponse.json({ ok: true, user: member })
  response.cookies.set('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,
    path:     '/',
  })
  return response
}
