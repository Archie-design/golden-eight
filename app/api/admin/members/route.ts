import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const payload = await getTokenPayload()
  if (!payload?.isAdmin) return null
  return payload
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })

  const db = createServerClient()
  const { data: members } = await db.from('members').select('*').order('id')
  return NextResponse.json({ ok: true, members: members ?? [] })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })

  const { name, phoneLast3, joinDate, level } = await request.json()
  if (!name || !phoneLast3 || !/^\d{3}$/.test(phoneLast3)) {
    return NextResponse.json({ ok: false, msg: '請填寫完整資料' }, { status: 400 })
  }

  const db = createServerClient()
  const { count } = await db.from('members').select('*', { count: 'exact', head: true })
  const newId = 'M' + String((count ?? 0) + 1).padStart(3, '0')

  const { error } = await db.from('members').insert({
    id: newId, name: name.trim(), phone_last3: phoneLast3,
    join_date: joinDate || new Date().toISOString().slice(0, 10), level,
  })

  if (error) return NextResponse.json({ ok: false, msg: '新增失敗：' + error.message }, { status: 500 })
  return NextResponse.json({ ok: true, msg: `已新增成員 ${name}` })
}
