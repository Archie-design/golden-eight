import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayTaipei, getYearMonth, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats } from '@/lib/scoring'
import type { Member, CheckInRecord } from '@/types'

// POST /api/cron/daily-reminder  (called by Vercel Cron at 22:00 UTC = 06:00 CST)
// Vercel passes Authorization: Bearer <CRON_SECRET> — verify it to prevent spoofing
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? ''}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, msg: 'Unauthorized' }, { status: 401 })
  }

  const db    = createServerClient()
  const today = getTodayTaipei()
  const ym    = getYearMonth(today)

  // Fetch active members who have NOT checked in today
  const { data: members } = await db
    .from('members').select('*').eq('status', '活躍')

  const { data: todayRecs } = await db
    .from('checkin_records').select('member_id').eq('date', today)

  const checkedInIds = new Set((todayRecs ?? []).map((r: { member_id: string }) => r.member_id))
  const missing = (members ?? []).filter((m: Member) => !checkedInIds.has(m.id))

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, msg: '全員已打卡', notified: 0 })
  }

  // For each missing member, compute their current month stats to include in the message
  const { data: monthRecs } = await db
    .from('checkin_records').select('*')
    .in('member_id', missing.map((m: Member) => m.id))
    .gte('date', ym + '-01').lte('date', getMonthEnd(ym))

  const recsByMember: Record<string, CheckInRecord[]> = {}
  ;(monthRecs ?? []).forEach((r: CheckInRecord) => {
    if (!recsByMember[r.member_id]) recsByMember[r.member_id] = []
    recsByMember[r.member_id].push(r)
  })

  // Build reminder summary (LINE Messaging API / webhook can be wired here)
  const reminders = missing.map((m: Member) => {
    const stats = calcMonthStats(m, recsByMember[m.id] ?? [], today)
    return {
      memberId:   m.id,
      name:       m.name,
      rate:       stats.rate,
      remaining:  stats.remaining,
      targetScore: stats.targetScore,
    }
  })

  // TODO: send LINE push messages here when LINE Messaging API is configured
  // For now, log the reminder list and return it
  console.log('[daily-reminder]', today, JSON.stringify(reminders))

  return NextResponse.json({ ok: true, notified: reminders.length, reminders })
}
