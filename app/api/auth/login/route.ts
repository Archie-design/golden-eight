import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createToken } from '@/lib/auth'
import { LoginSchema, parseBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, LoginSchema)
  if (parsed instanceof NextResponse) return parsed
  const { name, phoneLast3 } = parsed.data

  const db = createServerClient()
  const { data: member } = await db
    .from('members')
    .select('*')
    .eq('name', name.trim())
    .eq('phone_last3', phoneLast3)
    .eq('status', '活躍')
    .single()

  if (!member) {
    return NextResponse.json({ ok: false, msg: '找不到此成員，請確認姓名與手機末三碼' }, { status: 401 })
  }

  const token = await createToken({ sub: member.id, isAdmin: member.is_admin })

  const response = NextResponse.json({ ok: true, user: member })
  response.cookies.set('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return response
}
