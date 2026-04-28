import { NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats, calcMaxPunchStreak, calcPenalty, calcMonthlyAchievements, calcWorkHoursDeduction } from '@/lib/scoring'
import { getWorkingDaysInMonth } from '@/lib/working-days'
import { LEVEL_THRESHOLDS } from '@/lib/constants'
import type { Member, CheckInRecord } from '@/types'

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const body = await req.json().catch(() => ({})) as { yearMonth?: string }
  const today     = getTodayTaipei()
  const yearMonth = /^\d{4}-\d{2}$/.test(body.yearMonth ?? '')
    ? body.yearMonth!
    : today.substring(0, 7)

  const { data: members } = await db.from('members').select('*').eq('status', '活躍')
  if (!members?.length) return NextResponse.json({ ok: true, msg: `月結完成（${yearMonth}）`, results: [] })

  const memberList = members as Member[]
  const memberIds  = memberList.map(m => m.id)

  // 一次撈取全部打卡紀錄 + 所有成就 + 工作日數，避免 per-member N+1
  const [recsRes, achRes, workingDays] = await Promise.all([
    db.from('checkin_records').select('*')
      .in('member_id', memberIds)
      .gte('date', yearMonth + '-01').lte('date', getMonthEnd(yearMonth)),
    db.from('achievements').select('member_id, code')
      .in('member_id', memberIds),
    getWorkingDaysInMonth(yearMonth, db),
  ])

  const recsByMember: Record<string, CheckInRecord[]> = {}
  ;((recsRes.data ?? []) as CheckInRecord[]).forEach(r => {
    (recsByMember[r.member_id] ??= []).push(r)
  })

  const codesByMember: Record<string, string[]> = {}
  ;((achRes.data ?? []) as { member_id: string; code: string }[]).forEach(a => {
    (codesByMember[a.member_id] ??= []).push(a.code)
  })

  // 準備批次寫入資料
  const summaryRows: Record<string, unknown>[] = []
  const achInserts:  { member_id: string; code: string }[] = []
  const levelUpdates: { id: string; level: string }[] = []
  const results: { name: string; passing: boolean; penalty: number }[] = []

  for (const m of memberList) {
    const records    = recsByMember[m.id] ?? []
    const stats      = calcMonthStats(m, records, today)
    const maxStreak  = calcMaxPunchStreak(records)
    const isDawnKing = records.length > 0 && records.every(r => r.tasks[1])

    // 工時補扣
    const totalWorkHours = records.reduce((s, r) => s + ((r as CheckInRecord & { work_hours?: number | null }).work_hours ?? 0), 0)
    const whDeduction    = calcWorkHoursDeduction(totalWorkHours, workingDays)

    // 套用補扣後重算 rate / passing
    const adjustedTotal  = stats.totalScore - whDeduction
    const threshold      = LEVEL_THRESHOLDS[m.level] ?? 0.6
    const adjustedRate   = stats.maxScore > 0 ? Math.round((adjustedTotal / stats.maxScore) * 100) : 0
    const adjustedPassing = adjustedRate >= threshold * 100

    const penalty = calcPenalty(m.level, adjustedPassing)

    summaryRows.push({
      member_id:             m.id,
      year_month:            yearMonth,
      total_score:           adjustedTotal,
      max_score:             stats.maxScore,
      rate:                  adjustedRate,
      passing:               adjustedPassing,
      penalty,
      max_streak:            maxStreak,
      is_dawn_king:          isDawnKing,
      work_hours_deduction:  whDeduction,
      settled_at:            new Date().toISOString(),
    })

    const monthAchs = calcMonthlyAchievements(adjustedPassing, adjustedRate, m.level, codesByMember[m.id] ?? [])
    for (const a of monthAchs) achInserts.push({ member_id: m.id, code: a.code })

    if (m.next_level) levelUpdates.push({ id: m.id, level: m.next_level })
    results.push({ name: m.name, passing: adjustedPassing, penalty })
  }

  // 批次寫入
  const { error: upsertErr } = await db.from('monthly_summary').upsert(summaryRows, { onConflict: 'member_id,year_month' })
  if (upsertErr) console.error('[settlement] upsert failed', upsertErr)

  if (achInserts.length) {
    const { error: achErr } = await db.from('achievements').insert(achInserts)
    if (achErr) console.error('[settlement] achievements insert failed', achErr)
  }

  // P2-11：依目標 level 分組，每組一次 update（最多 3 次 round-trip，取代 N 次）
  const byLevel: Record<string, string[]> = {}
  for (const u of levelUpdates) {
    (byLevel[u.level] ??= []).push(u.id)
  }
  await Promise.all(
    Object.entries(byLevel).map(([lvl, ids]) =>
      db.from('members').update({ level: lvl, next_level: null }).in('id', ids)
    )
  )

  return NextResponse.json({ ok: true, msg: `月結完成（${yearMonth}）`, results })
}
