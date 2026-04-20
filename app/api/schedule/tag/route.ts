import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCurrentMember } from '@/lib/api-helper'
import { CreateTagSchema, DeleteTagSchema, parseBody } from '@/lib/validation'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`tag:${getClientIp(request)}`, 30, 60_000)
  if (rl) return rl

  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const parsed = await parseBody(request, CreateTagSchema)
  if (parsed instanceof NextResponse) return parsed
  const { tagName, color, emoji } = parsed.data

  // P1-4：以 UUID 消除 count+1 競爭條件。
  const newId = 'U' + member.id + '_' + randomUUID().slice(0, 8)

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

  const { data: tag } = await db.from('tag_library').select('is_system, member_id').eq('id', tagId).single()
  if (!tag) return NextResponse.json({ ok: false, msg: '標籤不存在' }, { status: 404 })
  if (tag.is_system) return NextResponse.json({ ok: false, msg: '系統標籤無法刪除' }, { status: 403 })
  if (tag.member_id !== member.id) return NextResponse.json({ ok: false, msg: '無權限刪除此標籤' }, { status: 403 })

  // P2-16：一次 SQL 移除使用者所有 schedule_template 內該標籤，避免 N+1 update
  const { error: rpcErr } = await db.rpc('remove_tag_from_templates', {
    p_member_id: member.id,
    p_tag_id:    tagId,
  })
  if (rpcErr) {
    console.error('[schedule/tag] remove_tag_from_templates failed', rpcErr)
    return NextResponse.json({ ok: false, msg: '刪除失敗，請稍後再試' }, { status: 500 })
  }

  await db.from('tag_library').delete().eq('id', tagId)

  return NextResponse.json({ ok: true, msg: '已刪除標籤' })
}
