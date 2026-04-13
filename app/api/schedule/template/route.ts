import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

interface BlockTag { id?: string; name: string; color: string; emoji?: string }
interface Block { startTime: string; endTime: string; tags: BlockTag[] }

export async function POST(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const { blocks, isPublic }: { blocks: Block[]; isPublic: boolean } = await request.json()

  await db.from('schedule_template').delete().eq('member_id', member.id)

  if (blocks && blocks.length > 0) {
    const rows = blocks.map((b: Block) => ({
      member_id:  member.id,
      tag_name:   '',                        // NOT NULL 佔位
      start_time: b.startTime,
      end_time:   b.endTime,
      block_tags: b.tags,
      is_public:  isPublic ?? false,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await db.from('schedule_template').insert(rows)
    if (error) return NextResponse.json({ ok: false, msg: '儲存失敗：' + error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, msg: '模板已儲存' })
}
