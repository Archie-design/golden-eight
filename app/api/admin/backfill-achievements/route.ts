import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-helper'
import { calcNewAchievementsFromAggregates } from '@/lib/scoring'
import type { Member, CheckInRecord } from '@/types'

const STREAK_WINDOW = 105

// POST /api/admin/backfill-achievements
// 對所有現有打卡紀錄依時間順序重跑成就計算，補齊遺漏的成就。
// 相比舊版（每步都 slice(0, i+1)），此版以增量聚合避免 O(n²)。
export async function POST() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const { data: members } = await db
    .from('members').select('*').eq('status', '活躍').order('id')

  if (!members?.length) return NextResponse.json({ ok: true, inserted: 0, detail: [] })

  const summary: { memberId: string; name: string; added: string[] }[] = []
  let totalInserted = 0

  for (const member of members as Member[]) {
    const { data: allRecs } = await db
      .from('checkin_records').select('*')
      .eq('member_id', member.id).order('date')

    const { data: existing } = await db
      .from('achievements').select('code').eq('member_id', member.id)

    const alreadyUnlocked = new Set((existing ?? []).map((a: { code: string }) => a.code))
    const toInsert: { member_id: string; code: string }[] = []

    const sortedRecs = ((allRecs ?? []) as CheckInRecord[])
      .sort((a, b) => a.date.localeCompare(b.date))

    let totalCount = 0
    let perfectCount = 0

    for (let i = 0; i < sortedRecs.length; i++) {
      const todayRec = sortedRecs[i]
      totalCount   += 1
      perfectCount += todayRec.base_score === 8 ? 1 : 0

      const windowStart = Math.max(0, i - (STREAK_WINDOW - 1))
      const recent      = sortedRecs.slice(windowStart, i + 1)

      const seen = new Set([
        ...alreadyUnlocked,
        ...toInsert.map(t => t.code),
      ])

      const newOnes = calcNewAchievementsFromAggregates({
        totalCount,
        perfectCount,
        recentSorted:    recent,
        todayRecord:     todayRec,
        alreadyUnlocked: Array.from(seen),
      })
      for (const a of newOnes) {
        if (!seen.has(a.code)) toInsert.push({ member_id: member.id, code: a.code })
      }
    }

    if (toInsert.length > 0) {
      const { error } = await db.from('achievements').insert(toInsert)
      if (!error) {
        totalInserted += toInsert.length
        summary.push({ memberId: member.id, name: member.name, added: toInsert.map(t => t.code) })
      } else {
        console.error('[backfill-achievements] insert failed', member.id, error)
      }
    }
  }

  return NextResponse.json({ ok: true, inserted: totalInserted, detail: summary })
}
