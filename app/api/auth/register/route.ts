import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createToken } from '@/lib/auth'
import { RegisterSchema, parseBody } from '@/lib/validation'
import { hashPhone } from '@/lib/phone'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { AUTH_COOKIE_OPTIONS, AUTH_TOKEN_MAX_AGE } from '@/lib/cookie-options'

export async function POST(request: NextRequest) {
  // P1-6 rate limit：每 IP 每 10 分鐘 5 次註冊
  const rl = checkRateLimit(`register:${getClientIp(request)}`, 5, 10 * 60_000)
  if (rl) return rl

  const parsed = await parseBody(request, RegisterSchema)
  if (parsed instanceof NextResponse) return parsed
  const { name, phone, joinDate, level } = parsed.data

  const db = createServerClient()
  const phoneHash = hashPhone(phone)
  const last3     = phone.slice(-3)

  // 重複檢查：hash 優先；退而以舊 last3 比對（資料遷移期）
  const { data: possible } = await db
    .from('members')
    .select('id, name, phone_hash, phone_last3')
    .eq('name', name)

  const clash = (possible ?? []).some((m: { phone_hash: string | null; phone_last3: string | null }) =>
    m.phone_hash === phoneHash || (!m.phone_hash && m.phone_last3 === last3)
  )
  if (clash) {
    return NextResponse.json({ ok: false, msg: '此姓名與手機號已存在，請直接登入' }, { status: 409 })
  }

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
      phone_hash: phoneHash,
      join_date:  joinDate || new Date().toISOString().slice(0, 10),
      level,
    })
    .select('id, name, level, is_admin, token_version')
    .single()

  if (error || !member) {
    console.error('[register] insert failed', error)
    return NextResponse.json({ ok: false, msg: '註冊失敗，請稍後再試' }, { status: 500 })
  }

  const tv = (member as { token_version?: number }).token_version ?? 0
  const token = await createToken({ sub: member.id, isAdmin: false, tv })
  const response = NextResponse.json({ ok: true, user: { id: member.id, name: member.name, level: member.level, is_admin: member.is_admin } })
  response.cookies.set('token', token, { ...AUTH_COOKIE_OPTIONS, maxAge: AUTH_TOKEN_MAX_AGE })
  return response
}
