import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { createToken } from '@/lib/auth'
import { AUTH_COOKIE_OPTIONS, AUTH_TOKEN_MAX_AGE } from '@/lib/cookie-options'

export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result

  const { member } = result
  const tv    = (member as { token_version?: number }).token_version ?? 0
  const token = await createToken({ sub: member.id, isAdmin: member.is_admin, tv })

  const res = NextResponse.json({ ok: true, user: member })
  res.cookies.set('token', token, { ...AUTH_COOKIE_OPTIONS, maxAge: AUTH_TOKEN_MAX_AGE })
  return res
}
