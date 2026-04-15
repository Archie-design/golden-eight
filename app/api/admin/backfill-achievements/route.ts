import { NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'
import { calcNewAchievements } from '@/lib/scoring'
import type { Member, CheckInRecord } from '@/types'

// POST /api/admin/backfill-achievements
// 對所有現有打卡紀錄依時間順序重跑成就計算，補齊遺漏的成就
export async function POST() {
  const payload = await getTokenPayload()
  if (!payload?.isAdmin) return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })

  const db = createServerClient()

  // 取得所有活躍成員
  const { data: members } = await db
    .from('members').select('*').eq('status', '活躍').order('id')

  if (!members?.length) return NextResponse.json({ ok: true, inserted: 0, detail: [] })

  const summary: { memberId: string; name: string; added: string[] }[] = []
  let totalInserted = 0

  for (const member of members as Member[]) {
    // 取得該成員所有打卡紀錄（升序）
    const { data: allRecs } = await db
      .from('checkin_records').select('*')
      .eq('member_id', member.id).order('date')

    // 取得已解鎖成就（避免重複）
    const { data: existing } = await db
      .from('achievements').select('code').eq('member_id', member.id)

    const alreadyUnlocked = new Set((existing ?? []).map((a: { code: string }) => a.code))
    const toInsert: { member_id: string; code: string }[] = []

    // 依時間順序模擬逐筆打卡，重算成就
    const sortedRecs = ((allRecs ?? []) as CheckInRecord[])
      .sort((a, b) => a.date.localeCompare(b.date))

    for (let i = 0; i < sortedRecs.length; i++) {
      const recsUpToNow = sortedRecs.slice(0, i + 1)
      const todayRec    = sortedRecs[i]
      const alreadyCodes = [...alreadyUnlocked, ...toInsert.map(t => t.code)]

      const newOnes = calcNewAchievements(recsUpToNow, todayRec, alreadyCodes)
      for (const a of newOnes) {
        if (!alreadyUnlocked.has(a.code) && !toInsert.some(t => t.code === a.code)) {
          toInsert.push({ member_id: member.id, code: a.code })
        }
      }
    }

    if (toInsert.length > 0) {
      const { error } = await db.from('achievements').insert(toInsert)
      if (!error) {
        totalInserted += toInsert.length
        summary.push({ memberId: member.id, name: member.name, added: toInsert.map(t => t.code) })
      }
    }
  }

  return NextResponse.json({ ok: true, inserted: totalInserted, detail: summary })
}
