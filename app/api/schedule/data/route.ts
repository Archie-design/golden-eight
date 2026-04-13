import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const [tagsRes, blocksRes] = await Promise.all([
    db.from('tag_library').select('*').or(`member_id.eq.${member.id},is_system.eq.true`).order('is_system', { ascending: false }).order('created_at'),
    db.from('schedule_template').select('*').eq('member_id', member.id).order('start_time'),
  ])

  const blocks = (blocksRes.data ?? []).map((r: {
    id: number; start_time: string; end_time: string;
    block_tags: unknown; is_public: boolean
  }) => ({
    id:        r.id,
    startTime: r.start_time,
    endTime:   r.end_time,
    tags:      (r.block_tags as { id?: string; name: string; color: string; emoji?: string }[]) ?? [],
  }))

  return NextResponse.json({
    ok: true,
    tags:     tagsRes.data ?? [],
    blocks,
    isPublic: (blocksRes.data ?? []).some((r: { is_public: boolean }) => r.is_public),
  })
}
