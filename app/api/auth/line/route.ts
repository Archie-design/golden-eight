import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { randomBytes } from 'crypto'
import { AUTH_COOKIE_OPTIONS, SHORT_STATE_MAX_AGE } from '@/lib/cookie-options'

const CHANNEL_ID    = process.env.LINE_CHANNEL_ID    ?? ''
const CALLBACK_URL  = process.env.LINE_CALLBACK_URL  ?? ''

// GET /api/auth/line — generate OAuth URL and return it
export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result

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

  // Store state in short-lived cookie (10 min) for CSRF verification
  const res = NextResponse.json({ ok: true, url: authUrl })
  res.cookies.set('line_state', state, { ...AUTH_COOKIE_OPTIONS, maxAge: SHORT_STATE_MAX_AGE })
  return res
}

// DELETE /api/auth/line — unbind LINE account
export async function DELETE() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  await db.from('members').update({
    line_user_id:      null,
    line_display_name: null,
    line_picture_url:  null,
  }).eq('id', member.id)

  return NextResponse.json({ ok: true, msg: '已解除 LINE 帳號綁定' })
}
