import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { db } = result

  const { data } = await db
    .from('schedule_template')
    .select('*, members(name)')
    .eq('is_public', true)
    .order('member_id')
    .order('start_time')

  const grouped: Record<string, {
    memberName: string
    blocks: { id: number; startTime: string; endTime: string; tags: unknown[] }[]
  }> = {}

  for (const row of data ?? []) {
    const r = row as {
      id: number; member_id: string; start_time: string; end_time: string
      block_tags: unknown[]; members: { name: string }
    }
    if (!grouped[r.member_id]) {
      grouped[r.member_id] = { memberName: r.members?.name ?? '', blocks: [] }
    }
    grouped[r.member_id].blocks.push({
      id:        r.id,
      startTime: r.start_time,
      endTime:   r.end_time,
      tags:      r.block_tags ?? [],
    })
  }

  return NextResponse.json({ ok: true, schedules: Object.values(grouped) })
}
