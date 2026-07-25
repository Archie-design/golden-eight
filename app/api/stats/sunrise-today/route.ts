// ============================================================
// 今日全體日出照（登入學員可見）— 供儀表板「今日大家的日出」彈窗
// ============================================================

import { NextResponse } from 'next/server'
import { getCurrentMember, getCheckinDayTaipei } from '@/lib/api-helper'

const BUCKET = 'sunrise-photos'

export async function GET(request: Request) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { db } = result

  const rawDate = new URL(request.url).searchParams.get('date')
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate : getCheckinDayTaipei()

  // 當日所有已上傳日出照 + 成員名
  const { data, error } = await db
    .from('checkin_records')
    .select('sunrise_photo_path, members(name)')
    .eq('date', date)
    .not('sunrise_photo_path', 'is', null)
    .order('member_id')

  if (error) {
    console.error('[sunrise-today] query failed', error.message)
    return NextResponse.json({ ok: false, msg: '查詢失敗' }, { status: 500 })
  }

  type Row = { sunrise_photo_path: string; members: { name: string } | null }
  const photos = ((data ?? []) as unknown as Row[]).map(r => ({
    name: r.members?.name ?? '',
    url:  db.storage.from(BUCKET).getPublicUrl(r.sunrise_photo_path).data.publicUrl,
  }))

  return NextResponse.json({ ok: true, data: { date, photos } })
}
