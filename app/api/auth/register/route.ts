import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createToken } from '@/lib/auth'
import { RegisterSchema, parseBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, RegisterSchema)
  if (parsed instanceof NextResponse) return parsed
  const { name, phoneLast3, joinDate, level } = parsed.data

  const db = createServerClient()

  // 檢查是否已有同名同末三碼
  const { data: existing } = await db
    .from('members')
    .select('id')
    .eq('name', name.trim())
    .eq('phone_last3', phoneLast3)
    .single()

  if (existing) {
    return NextResponse.json({ ok: false, msg: '此姓名與手機末三碼已存在，請直接登入' }, { status: 409 })
  }

  // 產生 member ID
  const { count } = await db.from('members').select('*', { count: 'exact', head: true })
  const newId = 'M' + String((count ?? 0) + 1).padStart(3, '0')

  const { data: member, error } = await db
    .from('members')
    .insert({
      id:          newId,
      name:        name.trim(),
      phone_last3: phoneLast3,
      join_date:   joinDate || new Date().toISOString().slice(0, 10),
      level,
    })
    .select()
    .single()

  if (error || !member) {
    return NextResponse.json({ ok: false, msg: '註冊失敗，請稍後再試' }, { status: 500 })
  }

  const token = await createToken({ sub: member.id, isAdmin: false })

  const response = NextResponse.json({ ok: true, user: member })
  response.cookies.set('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return response
}
