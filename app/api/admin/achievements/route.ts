import { NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'
import { ACHIEVEMENT_LIST } from '@/lib/constants'
import type { Member } from '@/types'

// GET /api/admin/achievements — unlock counts per achievement + per-member summary
export async function GET() {
  const payload = await getTokenPayload()
  if (!payload?.isAdmin) return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })

  const db = createServerClient()

  const [{ data: achRows }, { data: members }] = await Promise.all([
    db.from('achievements').select('code, member_id, unlocked_at'),
    db.from('members').select('id, name').eq('status', '活躍').order('id'),
  ])

  // Count unlocks per achievement code
  const countByCode: Record<string, number> = {}
  ;(achRows ?? []).forEach((a: { code: string }) => {
    countByCode[a.code] = (countByCode[a.code] ?? 0) + 1
  })

  // Total active members (denominator for rarity %)
  const totalMembers = (members ?? []).length

  // Build achievement stats sorted by rarity (fewest unlocks first)
  const achievementStats = ACHIEVEMENT_LIST.map(a => ({
    code:    a.code,
    name:    a.name,
    count:   countByCode[a.code] ?? 0,
    pct:     totalMembers > 0
      ? Math.round(((countByCode[a.code] ?? 0) / totalMembers) * 100)
      : 0,
  })).sort((a, b) => a.count - b.count || a.code.localeCompare(b.code))

  // Per-member unlock counts
  const memberCountMap: Record<string, number> = {}
  ;(achRows ?? []).forEach((a: { member_id: string }) => {
    memberCountMap[a.member_id] = (memberCountMap[a.member_id] ?? 0) + 1
  })

  const memberStats = (members ?? []).map((m: Pick<Member, 'id' | 'name'>) => ({
    id:    m.id,
    name:  m.name,
    count: memberCountMap[m.id] ?? 0,
    total: ACHIEVEMENT_LIST.length,
  })).sort((a, b) => b.count - a.count)

  return NextResponse.json({ ok: true, achievementStats, memberStats, totalMembers })
}
