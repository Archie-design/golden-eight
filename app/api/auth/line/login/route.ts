import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const CHANNEL_ID   = process.env.LINE_CHANNEL_ID   ?? ''
const CALLBACK_URL = process.env.LINE_CALLBACK_URL ?? ''

// GET /api/auth/line/login — generate OAuth URL for unauthenticated login (no JWT required)
export async function GET() {
  if (!CHANNEL_ID || !CALLBACK_URL) {
    return NextResponse.json({ ok: false, msg: 'LINE Login 尚未設定' }, { status: 503 })
  }

  const state = randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CHANNEL_ID,
    redirect_uri:  CALLBACK_URL,
    state,
    scope:         'profile openid',
  })

  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params}`

  const res = NextResponse.json({ ok: true, url: authUrl })
  res.cookies.set('line_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   600,
    path:     '/',
  })
  // Mark this as a login attempt (not a bind attempt)
  res.cookies.set('line_context', 'login', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   600,
    path:     '/',
  })
  return res
}
