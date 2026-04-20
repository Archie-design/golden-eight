import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { SaveTemplateSchema, parseBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const parsed = await parseBody(request, SaveTemplateSchema)
  if (parsed instanceof NextResponse) return parsed
  const { blocks, isPublic } = parsed.data

  await db.from('schedule_template').delete().eq('member_id', member.id)

  if (blocks && blocks.length > 0) {
    const rows = blocks.map(b => ({
      member_id:  member.id,
      start_time: b.startTime,
      end_time:   b.endTime,
      block_tags: b.tags,
      is_public:  isPublic ?? false,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await db.from('schedule_template').insert(rows)
    if (error) {
      console.error('[schedule/template] insert failed', error)
      return NextResponse.json({ ok: false, msg: '儲存失敗，請稍後再試' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, msg: '模板已儲存' })
}
