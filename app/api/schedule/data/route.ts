import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const [tagsRes, entriesRes] = await Promise.all([
    db.from('tag_library').select('*').or(`member_id.eq.${member.id},is_system.eq.true`).order('is_system', { ascending: false }).order('created_at'),
    db.from('schedule_template').select('*').eq('member_id', member.id).order('start_time'),
  ])

  return NextResponse.json({
    ok: true,
    tags:    tagsRes.data ?? [],
    entries: entriesRes.data ?? [],
    isPublic: (entriesRes.data ?? []).some((e: { is_public: boolean }) => e.is_public),
  })
}
