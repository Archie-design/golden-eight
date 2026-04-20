import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'
import { createToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { AUTH_COOKIE_OPTIONS, AUTH_TOKEN_MAX_AGE } from '@/lib/cookie-options'

const CHANNEL_ID     = process.env.LINE_CHANNEL_ID     ?? ''
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? ''
const CALLBACK_URL   = process.env.LINE_CALLBACK_URL   ?? ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')

  // ── Verify CSRF state ──────────────────────────────────────────────────
  const cookieStore  = await cookies()
  const savedState   = cookieStore.get('line_state')?.value
  const raw          = cookieStore.get('line_context')?.value
  const lineContext  = raw === 'login' ? 'login' : 'bind'

  if (!state || !savedState || state !== savedState) {
    const dest = lineContext === 'login' ? '/?error=line_state' : '/dashboard?error=line_state'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  if (!code) {
    const dest = lineContext === 'login' ? '/?error=line_denied' : '/dashboard?error=line_denied'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  // ── Exchange code for access token ─────────────────────────────────────
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  CALLBACK_URL,
      client_id:     CHANNEL_ID,
      client_secret: CHANNEL_SECRET,
    }),
  })

  if (!tokenRes.ok) {
    const dest = lineContext === 'login' ? '/?error=line_token' : '/dashboard?error=line_token'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  const { access_token } = await tokenRes.json() as { access_token: string }

  // ── Fetch LINE profile ─────────────────────────────────────────────────
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!profileRes.ok) {
    const dest = lineContext === 'login' ? '/?error=line_profile' : '/dashboard?error=line_profile'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  const profile = await profileRes.json() as {
    userId:      string
    displayName: string
    pictureUrl?: string
  }

  const db = createServerClient()

  function clearStatecookies(res: NextResponse) {
    res.cookies.set('line_state',   '', { maxAge: 0, path: '/' })
    res.cookies.set('line_context', '', { maxAge: 0, path: '/' })
    return res
  }

  // ══════════════════════════════════════════════════════════════════════
  // LOGIN context: look up member by LINE ID and issue JWT
  // ══════════════════════════════════════════════════════════════════════
  if (lineContext === 'login') {
    const { data: member } = await db
      .from('members')
      .select('*')
      .eq('line_user_id', profile.userId)
      .eq('status', '活躍')
      .maybeSingle()

    if (!member) {
      return clearStatecookies(NextResponse.redirect(new URL('/?error=line_not_bound', req.url)))
    }

    const tv    = (member as { token_version?: number }).token_version ?? 0
    const token = await createToken({ sub: member.id, isAdmin: member.is_admin, tv })
    const res   = NextResponse.redirect(new URL('/checkin', req.url))
    res.cookies.set('token', token, { ...AUTH_COOKIE_OPTIONS, maxAge: AUTH_TOKEN_MAX_AGE })
    return clearStatecookies(res)
  }

  // ══════════════════════════════════════════════════════════════════════
  // BIND context: attach LINE ID to the currently logged-in member
  // ══════════════════════════════════════════════════════════════════════
  const authResult = await getCurrentMember()
  if (authResult instanceof NextResponse) {
    return clearStatecookies(NextResponse.redirect(new URL('/?error=unauth', req.url)))
  }
  const { member, db: bindDb } = authResult

  // Check if this LINE ID is already bound to another member
  const { data: existing } = await bindDb
    .from('members')
    .select('id')
    .eq('line_user_id', profile.userId)
    .neq('id', member.id)
    .maybeSingle()

  if (existing) {
    return clearStatecookies(NextResponse.redirect(new URL('/dashboard?error=line_taken', req.url)))
  }

  await bindDb.from('members').update({
    line_user_id:      profile.userId,
    line_display_name: profile.displayName,
    line_picture_url:  profile.pictureUrl ?? null,
  }).eq('id', member.id)

  return clearStatecookies(NextResponse.redirect(new URL('/dashboard?line=bound', req.url)))
}
