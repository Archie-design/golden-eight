import { NextResponse } from 'next/server'
import { AUTH_COOKIE_OPTIONS } from '@/lib/cookie-options'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('token', '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 })
  return response
}
