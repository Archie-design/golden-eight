import { NextResponse } from 'next/server'
import { getTokenPayload, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'
import { calcMonthStats, calcMaxPunchStreak, calcPenalty, calcMonthlyAchievements } from '@/lib/scoring'
import type { Member, CheckInRecord } from '@/types'

export async function POST() {
  const payload = await getTokenPayload()
  if (!payload?.isAdmin) return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })

  const db        = createServerClient()
  const today     = getTodayTaipei()
  const yearMonth = today.substring(0, 7)

  const { data: members } = await db.from('members').select('*').eq('status', '活躍')

  const results = await Promise.all(
    (members ?? []).map(async (m: Member) => {
      const { data: recs } = await db
        .from('checkin_records').select('*')
        .eq('member_id', m.id).gte('date', yearMonth + '-01').lte('date', getMonthEnd(yearMonth))

      const records   = (recs ?? []) as CheckInRecord[]
      const stats     = calcMonthStats(m, records, today)
      const maxStreak = calcMaxPunchStreak(records)
      const penalty   = calcPenalty(m.level, stats.passing)
      const isDawnKing = records.length > 0 && records.every(r => r.tasks[1])

      // 寫入月結摘要（upsert）
      await db.from('monthly_summary').upsert({
        member_id:   m.id,
        year_month:  yearMonth,
        total_score: stats.totalScore,
        max_score:   stats.maxScore,
        rate:        stats.rate,
        passing:     stats.passing,
        penalty,
        max_streak:  maxStreak,
        is_dawn_king: isDawnKing,
        settled_at:  new Date().toISOString(),
      }, { onConflict: 'member_id,year_month' })

      // 月度成就
      const { data: existing } = await db.from('achievements').select('code').eq('member_id', m.id)
      const existingCodes = (existing ?? []).map((a: { code: string }) => a.code)
      const monthAchs = calcMonthlyAchievements(stats.passing, stats.rate, m.level, existingCodes)
      if (monthAchs.length > 0) {
        await db.from('achievements').insert(monthAchs.map(a => ({ member_id: m.id, code: a.code })))
      }

      // 進月後更新下月階梯
      if (m.next_level) {
        await db.from('members').update({ level: m.next_level, next_level: null }).eq('id', m.id)
      }

      return { name: m.name, passing: stats.passing, penalty }
    })
  )

  return NextResponse.json({ ok: true, msg: `月結完成（${yearMonth}）`, results })
}
