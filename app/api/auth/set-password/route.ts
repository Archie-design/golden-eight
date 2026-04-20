import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { hashPassword, verifyPassword } from '@/lib/password'
import { SetPasswordSchema, parseBody } from '@/lib/validation'

export async function POST(request: Request) {
  const authResult = await getCurrentMember()
  if (authResult instanceof NextResponse) return authResult
  const { member, db } = authResult

  const parsed = await parseBody(request, SetPasswordSchema)
  if (parsed instanceof NextResponse) return parsed
  const { password, currentPassword } = parsed.data

  // Fetch server-side password_hash (not included in getCurrentMember select)
  const { data: row } = await db
    .from('members')
    .select('password_hash')
    .eq('id', member.id)
    .single()

  const storedHash = (row as { password_hash?: string | null } | null)?.password_hash ?? null

  if (storedHash) {
    if (!currentPassword) {
      return NextResponse.json({ ok: false, msg: '請輸入現有密碼' }, { status: 400 })
    }
    const ok = await verifyPassword(currentPassword, storedHash)
    if (!ok) {
      return NextResponse.json({ ok: false, msg: '現有密碼錯誤' }, { status: 401 })
    }
  }

  const newHash = await hashPassword(password)
  await db.from('members').update({ password_hash: newHash }).eq('id', member.id)

  return NextResponse.json({ ok: true })
}
