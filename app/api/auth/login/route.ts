import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createToken } from '@/lib/auth'
import { LoginSchema, parseBody } from '@/lib/validation'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

type MemberRow = {
  id:               string
  name:             string
  phone_full:       string | null
  phone_last3:      string | null
  is_admin:         boolean
  status:           string
  failed_attempts:  number
  locked_until:     string | null
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, LoginSchema)
  if (parsed instanceof NextResponse) return parsed
  const { name, phone } = parsed.data

  const db = createServerClient()

  // 1. 依姓名查出所有可能對象（允許同名）
  const { data: candidates } = await db
    .from('members').select('*')
    .eq('name', name)
    .eq('status', '活躍')

  const matches = (candidates ?? []) as MemberRow[]

  // 任一匹配成員在鎖定期內 → 直接拒絕（避免攻擊者枚舉哪個帳號存在）
  const now    = Date.now()
  const locked = matches.find(m => m.locked_until && Date.parse(m.locked_until) > now)
  if (locked) {
    const remain = Math.ceil((Date.parse(locked.locked_until!) - now) / 60_000)
    return NextResponse.json(
      { ok: false, msg: `嘗試次數過多，請 ${remain} 分鐘後再試` },
      { status: 429 }
    )
  }

  // 2. 在候選中找出手機號相符者
  const last3 = phone.slice(-3)
  const hit = matches.find(m =>
    m.phone_full === phone || (!m.phone_full && m.phone_last3 === last3)
  )

  if (!hit) {
    // 登入失敗：對所有同名候選累加失敗次數（保守策略）
    for (const m of matches) {
      const next   = (m.failed_attempts ?? 0) + 1
      const update: Record<string, unknown> = { failed_attempts: next }
      if (next >= MAX_ATTEMPTS) {
        update.locked_until = new Date(now + LOCK_MINUTES * 60_000).toISOString()
      }
      await db.from('members').update(update).eq('id', m.id)
    }
    return NextResponse.json({ ok: false, msg: '找不到此成員，請確認姓名與手機號' }, { status: 401 })
  }

  // 3. 成功：重置失敗計數；若為舊帳號（尚無 phone_full），順勢遷移
  const patch: Record<string, unknown> = { failed_attempts: 0, locked_until: null }
  if (!hit.phone_full) patch.phone_full = phone
  await db.from('members').update(patch).eq('id', hit.id)

  const token = await createToken({ sub: hit.id, isAdmin: hit.is_admin })
  const response = NextResponse.json({ ok: true, user: { id: hit.id, name: hit.name } })
  response.cookies.set('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,
    path:     '/',
  })
  return response
}
