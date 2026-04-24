import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createToken } from '@/lib/auth'
import { LoginSchema, parseBody } from '@/lib/validation'
import { hashPhone } from '@/lib/phone'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { AUTH_COOKIE_OPTIONS, AUTH_TOKEN_MAX_AGE } from '@/lib/cookie-options'
import { verifyPassword } from '@/lib/password'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

type MemberRow = {
  id:               string
  name:             string
  phone_full:       string | null
  phone_hash:       string | null
  password_hash:    string | null
  is_admin:         boolean
  status:           string
  failed_attempts:  number
  locked_until:     string | null
  token_version:    number | null
}

export async function POST(request: NextRequest) {
  // P1-6 rate limit：每 IP 每分鐘 10 次（成功/失敗皆計）
  const ipLimit = checkRateLimit(`login:${getClientIp(request)}`, 10, 60_000)
  if (ipLimit) return ipLimit

  const parsed = await parseBody(request, LoginSchema)
  if (parsed instanceof NextResponse) return parsed
  const { name, phone, password } = parsed.data

  const db = createServerClient()
  const phoneHash = hashPhone(phone)
  const now       = Date.now()

  const { data: candidates } = await db
    .from('members').select('*')
    .eq('name', name)
    .eq('status', '活躍')
  const matches = (candidates ?? []) as MemberRow[]

  const hit = matches.find(m => m.phone_hash === phoneHash)

  // 命中 → 檢查鎖定
  if (hit?.locked_until && Date.parse(hit.locked_until) > now) {
    const remainSec = Math.ceil((Date.parse(hit.locked_until) - now) / 1000)
    return NextResponse.json(
      { ok: false, msg: `嘗試次數過多，請 ${Math.ceil(remainSec / 60)} 分鐘後再試` },
      { status: 429, headers: { 'Retry-After': String(remainSec) } },
    )
  }

  if (!hit) {
    // P0-1：姓名命中但手機錯誤時，只有「唯一候選」才累加失敗次數到該目標。
    // 多筆同名時無法判定攻擊者針對誰，不做 DB 鎖定 — 以 rate-limit 擋住。
    if (matches.length === 1) {
      const target = matches[0]
      const next   = (target.failed_attempts ?? 0) + 1
      const update: Record<string, unknown> = { failed_attempts: next }
      if (next >= MAX_ATTEMPTS) {
        update.locked_until = new Date(now + LOCK_MINUTES * 60_000).toISOString()
      }
      await db.from('members').update(update).eq('id', target.id)
    }
    return NextResponse.json(
      { ok: false, msg: '找不到此成員，請確認姓名與手機號' },
      { status: 401 },
    )
  }

  // 密碼驗證（有設定密碼才強制）
  if (hit.password_hash) {
    if (!password) {
      return NextResponse.json({ ok: false, msg: '請輸入密碼' }, { status: 401 })
    }
    const pwOk = await verifyPassword(password, hit.password_hash)
    if (!pwOk) {
      const next = (hit.failed_attempts ?? 0) + 1
      const update: Record<string, unknown> = { failed_attempts: next }
      if (next >= MAX_ATTEMPTS) {
        update.locked_until = new Date(now + LOCK_MINUTES * 60_000).toISOString()
      }
      await db.from('members').update(update).eq('id', hit.id)
      return NextResponse.json({ ok: false, msg: '密碼錯誤' }, { status: 401 })
    }
  }

  // 成功：重置失敗計數；phone_full 尚未補齊的帳號順勢遷移
  const patch: Record<string, unknown> = { failed_attempts: 0, locked_until: null }
  if (!hit.phone_full) patch.phone_full = phone
  await db.from('members').update(patch).eq('id', hit.id)

  const tv = hit.token_version ?? 0
  const token = await createToken({ sub: hit.id, isAdmin: hit.is_admin, tv })
  const response = NextResponse.json({ ok: true, user: { id: hit.id, name: hit.name } })
  response.cookies.set('token', token, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: AUTH_TOKEN_MAX_AGE,
  })
  return response
}
