import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

export async function POST(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const { level } = await request.json()
  const validLevels = ['黃金戰士', '白銀戰士', '青銅戰士']
  if (!validLevels.includes(level)) {
    return NextResponse.json({ ok: false, msg: '無效的階梯選項' }, { status: 400 })
  }

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())
  const day = parseInt(today.split('-')[2], 10)
  if (day < 25) {
    return NextResponse.json({ ok: false, msg: '每月 25 日後才可設定下月階梯' }, { status: 400 })
  }

  await db.from('members').update({ next_level: level }).eq('id', member.id)
  return NextResponse.json({ ok: true, msg: `已設定下月階梯為「${level}」` })
}
