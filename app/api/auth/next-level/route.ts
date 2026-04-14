import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { NextLevelSchema, parseBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const parsed = await parseBody(request, NextLevelSchema)
  if (parsed instanceof NextResponse) return parsed
  const { level } = parsed.data

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())
  const day = parseInt(today.split('-')[2], 10)
  if (day < 25) {
    return NextResponse.json({ ok: false, msg: '每月 25 日後才可設定下月階梯' }, { status: 400 })
  }

  await db.from('members').update({ next_level: level }).eq('id', member.id)
  return NextResponse.json({ ok: true, msg: `已設定下月階梯為「${level}」` })
}
