import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { CreateTagSchema, DeleteTagSchema, parseBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const parsed = await parseBody(request, CreateTagSchema)
  if (parsed instanceof NextResponse) return parsed
  const { tagName, color, emoji } = parsed.data

  const { count } = await db.from('tag_library').select('*', { count: 'exact', head: true }).eq('member_id', member.id)
  const newId = 'U' + member.id + '_' + String((count ?? 0) + 1).padStart(3, '0')

  const { data, error } = await db.from('tag_library').insert({
    id: newId, member_id: member.id, tag_name: tagName, color: color || '#4A90D9', emoji: emoji || null,
  }).select().single()

  if (error) return NextResponse.json({ ok: false, msg: '新增失敗' }, { status: 500 })
  return NextResponse.json({ ok: true, tag: data })
}

export async function DELETE(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const parsed = await parseBody(request, DeleteTagSchema)
  if (parsed instanceof NextResponse) return parsed
  const { tagId } = parsed.data

  // 不允許刪除系統標籤
  const { data: tag } = await db.from('tag_library').select('is_system, member_id').eq('id', tagId).single()
  if (!tag) return NextResponse.json({ ok: false, msg: '標籤不存在' }, { status: 404 })
  if (tag.is_system) return NextResponse.json({ ok: false, msg: '系統標籤無法刪除' }, { status: 403 })
  if (tag.member_id !== member.id) return NextResponse.json({ ok: false, msg: '無權限刪除此標籤' }, { status: 403 })

  // 一併清除模板中使用的此標籤
  await db.from('schedule_template').delete().eq('member_id', member.id).eq('tag_id', tagId)
  await db.from('tag_library').delete().eq('id', tagId)

  return NextResponse.json({ ok: true, msg: '已刪除標籤' })
}
