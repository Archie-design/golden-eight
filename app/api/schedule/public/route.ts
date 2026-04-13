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

  // 以成員分組
  const grouped: Record<string, { memberName: string; entries: unknown[] }> = {}
  for (const row of data ?? []) {
    const r = row as { member_id: string; members: { name: string }; [key: string]: unknown }
    if (!grouped[r.member_id]) {
      grouped[r.member_id] = { memberName: r.members?.name ?? '', entries: [] }
    }
    grouped[r.member_id].entries.push(row)
  }

  return NextResponse.json({ ok: true, schedules: Object.values(grouped) })
}
