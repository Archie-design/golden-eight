import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

export async function POST(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const { entries, isPublic } = await request.json()

  // 先刪除該成員所有行程
  await db.from('schedule_template').delete().eq('member_id', member.id)

  if (entries && entries.length > 0) {
    const rows = entries.map((e: { tagId?: string; tagName: string; startTime: string; endTime: string; note?: string }) => ({
      member_id:  member.id,
      tag_id:     e.tagId ?? null,
      tag_name:   e.tagName,
      start_time: e.startTime,
      end_time:   e.endTime,
      note:       e.note ?? '',
      is_public:  isPublic ?? false,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await db.from('schedule_template').insert(rows)
    if (error) return NextResponse.json({ ok: false, msg: '儲存失敗：' + error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, msg: '模板已儲存' })
}
