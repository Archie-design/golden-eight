import { NextResponse } from 'next/server'
import { getCurrentMember, getTodayTaipei } from '@/lib/api-helper'
import type { Member } from '@/types'

// GET /api/stats/history — last 6 months for current user + group average per month
export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  // Build list of last 6 year-month strings (newest first)
  const today = getTodayTaipei()
  const months: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(`${today}T00:00:00`)
    d.setMonth(d.getMonth() - i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  months.reverse()  // oldest → newest

  // Fetch all active members for group average
  const { data: allMembers } = await db
    .from('members').select('id').eq('status', '活躍')

  const allIds = (allMembers ?? []).map((m: Pick<Member, 'id'>) => m.id)

  const [userRows, groupRows] = await Promise.all([
    db.from('monthly_summary')
      .select('year_month, rate, total_score, passing')
      .eq('member_id', member.id)
      .in('year_month', months)
      .order('year_month'),
    db.from('monthly_summary')
      .select('year_month, rate')
      .in('member_id', allIds)
      .in('year_month', months),
  ])

  // Index user rows by month
  const userByMonth: Record<string, { rate: number; totalScore: number; passing: boolean }> = {}
  ;(userRows.data ?? []).forEach((r: { year_month: string; rate: number; total_score: number; passing: boolean }) => {
    userByMonth[r.year_month] = { rate: r.rate, totalScore: r.total_score, passing: r.passing }
  })

  // Compute group average per month
  const groupSums: Record<string, { sum: number; count: number }> = {}
  ;(groupRows.data ?? []).forEach((r: { year_month: string; rate: number }) => {
    if (!groupSums[r.year_month]) groupSums[r.year_month] = { sum: 0, count: 0 }
    groupSums[r.year_month].sum   += r.rate
    groupSums[r.year_month].count += 1
  })

  const history = months.map(ym => ({
    yearMonth:  ym,
    rate:       userByMonth[ym]?.rate        ?? null,
    totalScore: userByMonth[ym]?.totalScore  ?? null,
    passing:    userByMonth[ym]?.passing     ?? null,
    groupAvg:   groupSums[ym]
      ? Math.round(groupSums[ym].sum / groupSums[ym].count)
      : null,
  }))

  return NextResponse.json({ ok: true, history })
}
