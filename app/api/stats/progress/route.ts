import { NextResponse } from 'next/server'
import { getTokenPayload, getTodayTaipei } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'
import { calcMonthStats, calcMaxPunchStreak } from '@/lib/scoring'
import type { Member, CheckInRecord } from '@/types'

export async function GET() {
  const payload = await getTokenPayload()
  if (!payload?.isAdmin) {
    return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })
  }

  const db        = createServerClient()
  const today     = getTodayTaipei()
  const yearMonth = today.substring(0, 7)

  const { data: members } = await db.from('members').select('*').eq('status', '活躍').order('id')

  const rows = await Promise.all(
    (members ?? []).map(async (m: Member) => {
      const { data: recs } = await db
        .from('checkin_records').select('*')
        .eq('member_id', m.id).gte('date', yearMonth + '-01').lte('date', yearMonth + '-31')

      const stats     = calcMonthStats(m, (recs ?? []) as CheckInRecord[], today)
      const maxStreak = calcMaxPunchStreak((recs ?? []) as CheckInRecord[])
      const lastRec   = ((recs ?? []) as CheckInRecord[]).sort((a, b) => b.date.localeCompare(a.date))[0]
      const isDawnKing = ((recs ?? []) as CheckInRecord[]).every(r => r.tasks[1])

      return {
        id:        m.id,
        name:      m.name,
        level:     m.level,
        totalScore: stats.totalScore,
        maxScore:   stats.maxScore,
        rate:       stats.rate,
        passing:    stats.passing,
        maxStreak,
        isDawnKing,
      }
    })
  )

  return NextResponse.json({ ok: true, yearMonth, rows })
}
