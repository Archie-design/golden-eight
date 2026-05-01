import { NextResponse } from 'next/server'
import { getTokenPayload, getTodayTaipei, getYearMonth, getMonthEnd } from '@/lib/api-helper'
import { createServerClient } from '@/lib/supabase/server'
import { calcMonthStats, calcMaxPunchStreakFromSorted, isDawnKing } from '@/lib/scoring'
import { MEMBER_COLS_STATS, RECORD_COLS_STATS } from '@/lib/db-columns'
import type { Member, CheckInRecord } from '@/types'

// GET /api/stats/leaderboard?mode=current|best
export async function GET(req: Request) {
  const payload = await getTokenPayload()
  if (!payload) return NextResponse.json({ ok: false, msg: '未登入' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') === 'best' ? 'best' : 'current'

  const db          = createServerClient()
  const today       = getTodayTaipei()
  const currentYm   = getYearMonth(today)
  const rawMonth    = searchParams.get('month') ?? ''
  const ym          = /^\d{4}-\d{2}$/.test(rawMonth) && rawMonth <= currentYm
    ? rawMonth : currentYm
  const isCurrentMonth = ym === currentYm
  // 歷史月份以月底為基準，使 calcMonthStats 的分母涵蓋完整一個月
  const refDate = isCurrentMonth ? today : getMonthEnd(ym)

  const { data: members } = await db
    .from('members').select(MEMBER_COLS_STATS).eq('status', '活躍').order('id')

  if (!members?.length) return NextResponse.json({ ok: true, mode, rows: [] })

  // ── Fetch all achievement counts in one query ────────────────────────────
  const { data: achRows } = await db
    .from('achievements')
    .select('member_id')
    .in('member_id', members.map((m: Member) => m.id))

  const achCount: Record<string, number> = {}
  ;(achRows ?? []).forEach((a: { member_id: string }) => {
    achCount[a.member_id] = (achCount[a.member_id] ?? 0) + 1
  })

  type LeaderRow = {
    id: string; name: string; level: string; totalScore: number
    maxScore: number | null; rate: number; passing: boolean
    maxStreak: number; isDawnKing: boolean; achievementCount: number
    yearMonth: string; exempted: boolean; rank: number
  }
  let rows: Omit<LeaderRow, 'rank'>[]

  if (mode === 'current') {
    // ── Current-month leaderboard (calculated live) ───────────────────────
    const { data: allRecs } = await db
      .from('checkin_records').select(RECORD_COLS_STATS)
      .in('member_id', members.map((m: Member) => m.id))
      .gte('date', ym + '-01').lte('date', getMonthEnd(ym))
      .order('date')

    const recsByMember: Record<string, CheckInRecord[]> = {}
    ;(allRecs ?? []).forEach((r: CheckInRecord) => {
      if (!recsByMember[r.member_id]) recsByMember[r.member_id] = []
      recsByMember[r.member_id].push(r)
    })

    rows = members.map((m: Member) => {
      const recs      = recsByMember[m.id] ?? []
      const stats     = calcMonthStats(m, recs, refDate)
      const maxS      = calcMaxPunchStreakFromSorted(recs)
      return {
        id:               m.id,
        name:             m.name,
        level:            m.level,
        totalScore:       stats.totalScore,
        maxScore:         stats.maxScore,
        rate:             stats.rate,
        passing:          stats.passing,
        maxStreak:        maxS,
        isDawnKing:       isDawnKing(m, recs, ym, refDate),
        achievementCount: achCount[m.id] ?? 0,
        yearMonth:        ym,
        exempted:         stats.maxScore === 0,
      }
    })
  } else {
    // ── Historical best (from monthly_summary) ────────────────────────────
    const { data: summaries } = await db
      .from('monthly_summary')
      .select('member_id, rate, total_score, year_month, max_streak, is_dawn_king')
      .in('member_id', members.map((m: Member) => m.id))

    const bestByMember: Record<string, { rate: number; totalScore: number; yearMonth: string; maxStreak: number; isDawnKing: boolean }> = {}
    ;(summaries ?? []).forEach((s: { member_id: string; rate: number; total_score: number; year_month: string; max_streak: number; is_dawn_king: boolean }) => {
      const prev = bestByMember[s.member_id]
      if (!prev || s.rate > prev.rate || (s.rate === prev.rate && s.total_score > prev.totalScore)) {
        bestByMember[s.member_id] = {
          rate:       s.rate,
          totalScore: s.total_score,
          yearMonth:  s.year_month,
          maxStreak:  s.max_streak,
          isDawnKing: s.is_dawn_king,
        }
      }
    })

    rows = members.map((m: Member) => {
      const best = bestByMember[m.id]
      return {
        id:               m.id,
        name:             m.name,
        level:            m.level,
        totalScore:       best?.totalScore  ?? 0,
        maxScore:         null,
        rate:             best?.rate        ?? 0,
        passing:          best ? best.rate >= (m.level === '黃金戰士' ? 80 : m.level === '白銀戰士' ? 70 : 60) : false,
        maxStreak:        best?.maxStreak   ?? 0,
        isDawnKing:       best?.isDawnKing  ?? false,
        achievementCount: achCount[m.id]    ?? 0,
        yearMonth:        best?.yearMonth   ?? '—',
        exempted:         !best,
      }
    })
  }

  // Sort: 不參與計分者固定排在最後 → rate desc → totalScore desc → name asc
  rows.sort((a, b) =>
    Number(a.exempted) - Number(b.exempted) ||
    b.rate - a.rate ||
    b.totalScore - a.totalScore ||
    a.name.localeCompare(b.name)
  )

  // Assign rank (ties get same rank)
  let rank = 1
  rows = rows.map((r, i) => {
    if (i > 0 && (r.rate !== rows[i - 1].rate || r.totalScore !== rows[i - 1].totalScore)) rank = i + 1
    return { ...r, rank }
  })

  return NextResponse.json({ ok: true, mode, yearMonth: ym, isCurrentMonth, currentYearMonth: currentYm, rows })
}
