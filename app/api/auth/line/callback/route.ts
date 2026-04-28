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
    const res   = NextResponse.redirect(new URL('/checkin?from=line', req.url))
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

  // 回傳 HTML：嘗試 postMessage 給 PWA 父視窗，iOS 無 opener 時顯示手動關閉提示
  // D2: JSON.stringify does not escape </script>; replace < > with Unicode escapes
  // so the inline <script> block cannot be terminated by a LINE display name.
  const safePayload = JSON.stringify({
    type:        'line_bound',
    displayName: profile.displayName,
    pictureUrl:  profile.pictureUrl ?? null,
  }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
  const html = `<!doctype html><html lang="zh-TW"><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>綁定成功</title>
<style>
  body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
       min-height:100dvh;margin:0;background:#fef3c7}
  .box{text-align:center;padding:2rem}
  .icon{font-size:3.5rem}
  .msg{margin:.75rem 0 .25rem;font-size:1.15rem;font-weight:700;color:#92400e}
  .sub{color:#78716c;font-size:.9rem}
  button{margin-top:1.25rem;padding:.65rem 1.6rem;background:#f59e0b;color:#fff;
         border:none;border-radius:.5rem;font-size:1rem;cursor:pointer}
</style>
</head><body><div class="box">
  <div class="icon">✅</div>
  <p class="msg">LINE 帳號綁定成功！</p>
  <p class="sub" id="sub">正在關閉視窗…</p>
  <button id="btn" style="display:none" onclick="window.close()">關閉視窗</button>
</div><script>
  var data = ${safePayload};
  if (window.opener) {
    try { window.opener.postMessage(data, location.origin) } catch(e) {}
    window.close();
  } else {
    document.getElementById('sub').textContent = '請關閉此視窗，返回 App。';
    document.getElementById('btn').style.display = 'inline-block';
  }
</script></body></html>`

  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' })
  headers.append('Set-Cookie', 'line_state=; Max-Age=0; Path=/')
  headers.append('Set-Cookie', 'line_context=; Max-Age=0; Path=/')
  return new Response(html, { headers })
}
