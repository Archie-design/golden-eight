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

  // P0-2：delete + insert 在 Postgres function 內同一 transaction 完成，
  // 避免刪除後 insert 失敗導致使用者全部排程遺失。
  const { error } = await db.rpc('replace_schedule_template', {
    p_member_id: member.id,
    p_is_public: isPublic ?? false,
    p_blocks:    blocks,
  })

  if (error) {
    console.error('[schedule/template] replace rpc failed', error)
    return NextResponse.json({ ok: false, msg: '儲存失敗，請稍後再試' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, msg: '模板已儲存' })
}
