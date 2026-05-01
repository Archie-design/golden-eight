import { getMonthEnd } from './api-helper'
import {
  calcMonthStats, calcMaxPunchStreakFromSorted, calcPenalty,
  calcMonthlyAchievements, calcWorkHoursDeduction, isDawnKing,
} from './scoring'
import { getWorkingDaysInRange } from './working-days'
import { LEVEL_THRESHOLDS, WORK_HOURS_TRACKING_START } from './constants'
import { MEMBER_COLS_SETTLEMENT, RECORD_COLS_SETTLEMENT } from './db-columns'
import type { Member, CheckInRecord } from '@/types'

interface SupabaseLike {
  from: (table: string) => unknown
  rpc?: unknown
}

export interface SettlementResult {
  yearMonth: string
  results:   { name: string; passing: boolean; penalty: number }[]
  exempted:  { name: string }[]
}

/**
 * 對指定月份執行月結。供 admin 手動結算與 cron 自動結算共用。
 * 副作用：寫入 monthly_summary、月度成就 achievements、套用 next_level → level。
 * 對 maxScore=0（新進成員，effective_start_date 晚於本月）一律跳過。
 */
export async function runSettlement(
  db: SupabaseLike,
  yearMonth: string,
  today: string,
): Promise<SettlementResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any

  const { data: members } = await dbAny
    .from('members').select(MEMBER_COLS_SETTLEMENT).eq('status', '活躍')

  if (!members?.length) return { yearMonth, results: [], exempted: [] }

  const memberList = members as Member[]
  const memberIds  = memberList.map(m => m.id)

  // 工時補扣窗口：max(monthStart, WORK_HOURS_TRACKING_START) ~ monthEnd
  // 4 月只計 4/29-4/30；5 月起整月（monthStart > tracking start，效果等同整月）
  const monthStartStr = yearMonth + '-01'
  const monthEndStr   = getMonthEnd(yearMonth)
  const whWindowStart = monthStartStr > WORK_HOURS_TRACKING_START
    ? monthStartStr
    : WORK_HOURS_TRACKING_START

  const [recsRes, achRes, whWorkingDays, pastSummariesRes] = await Promise.all([
    dbAny.from('checkin_records').select(RECORD_COLS_SETTLEMENT)
      .in('member_id', memberIds)
      .gte('date', monthStartStr).lte('date', monthEndStr)
      .order('date'),
    dbAny.from('achievements').select('member_id, code')
      .in('member_id', memberIds),
    whWindowStart > monthEndStr
      ? Promise.resolve(0)  // tracking start 在月底之後 → 工時補扣窗口為空
      : getWorkingDaysInRange(whWindowStart, monthEndStr, dbAny),
    dbAny.from('monthly_summary').select('member_id, passing')
      .in('member_id', memberIds),
  ])

  const recsByMember: Record<string, CheckInRecord[]> = {}
  ;((recsRes.data ?? []) as CheckInRecord[]).forEach((r: CheckInRecord) => {
    (recsByMember[r.member_id] ??= []).push(r)
  })

  const codesByMember: Record<string, string[]> = {}
  ;((achRes.data ?? []) as { member_id: string; code: string }[]).forEach(a => {
    (codesByMember[a.member_id] ??= []).push(a.code)
  })

  const passCountByMember: Record<string, number> = {}
  ;((pastSummariesRes.data ?? []) as { member_id: string; passing: boolean }[]).forEach(r => {
    if (r.passing) passCountByMember[r.member_id] = (passCountByMember[r.member_id] ?? 0) + 1
  })

  const summaryRows: Record<string, unknown>[] = []
  const achInserts:  { member_id: string; code: string }[] = []
  const levelUpdates: { id: string; level: string }[] = []
  const results:  { name: string; passing: boolean; penalty: number }[] = []
  const exempted: { id: string; name: string }[] = []

  // 計分基準日：min(today, monthEnd)。歷史月份用月底，本月（月中重跑）用今日
  // 必須用此 refDate 而非 today — 否則 calcMonthStats 內部會以 today 的月份取 yearMonth，
  // 對歷史月份結算時會把分母 / 起算月份算成「當月」，導致 totalScore=0、rate 變 0% 或負數。
  const monthEnd = getMonthEnd(yearMonth)
  const refDate  = today > monthEnd ? monthEnd : today

  // 破曉王：群組本月最長連打天數的最大值（可並列）
  const groupMaxStreak = Math.max(
    0,
    ...memberList.map(m => calcMaxPunchStreakFromSorted(recsByMember[m.id] ?? [])),
  )

  for (const m of memberList) {
    const records = recsByMember[m.id] ?? []
    const stats   = calcMonthStats(m, records, refDate)

    // 新進成員 maxScore=0：不參與計分，跳過所有副作用
    if (stats.maxScore === 0) {
      exempted.push({ id: m.id, name: m.name })
      continue
    }

    const maxStreak       = calcMaxPunchStreakFromSorted(records)
    const memberIsDawnKing = isDawnKing(maxStreak, groupMaxStreak)

    // 工時補扣只計 whWindowStart 之後的紀錄（4 月限 4/29-4/30；5 月起整月）
    const totalWorkHours = records
      .filter(r => r.date >= whWindowStart)
      .reduce((s, r) => {
        const wh = (r as CheckInRecord & { work_hours?: number | null }).work_hours
        return s + (wh != null ? wh : r.tasks[4] ? 8 : 0)
      }, 0)
    const whDeduction = calcWorkHoursDeduction(totalWorkHours, whWorkingDays)

    const adjustedTotal   = stats.totalScore - whDeduction
    const threshold       = LEVEL_THRESHOLDS[m.level] ?? 0.6
    const adjustedRate    = stats.maxScore > 0 ? Math.round((adjustedTotal / stats.maxScore) * 100) : 0
    const adjustedPassing = adjustedRate >= threshold * 100
    const penalty         = calcPenalty(m.level, adjustedPassing)

    summaryRows.push({
      member_id:            m.id,
      year_month:           yearMonth,
      total_score:          adjustedTotal,
      max_score:            stats.maxScore,
      rate:                 adjustedRate,
      passing:              adjustedPassing,
      penalty,
      max_streak:           maxStreak,
      is_dawn_king:         memberIsDawnKing,
      work_hours_deduction: whDeduction,
      settled_at:           new Date().toISOString(),
    })

    const passingCount = (passCountByMember[m.id] ?? 0) + (adjustedPassing ? 1 : 0)
    const monthAchs = calcMonthlyAchievements(adjustedPassing, adjustedRate, m.level, codesByMember[m.id] ?? [], passingCount)
    for (const a of monthAchs) achInserts.push({ member_id: m.id, code: a.code })

    if (m.next_level) levelUpdates.push({ id: m.id, level: m.next_level })
    results.push({ name: m.name, passing: adjustedPassing, penalty })
  }

  const { error: upsertErr } = await dbAny.from('monthly_summary').upsert(summaryRows, { onConflict: 'member_id,year_month' })
  if (upsertErr) console.error('[settlement] upsert failed', upsertErr)

  if (achInserts.length) {
    const { error: achErr } = await dbAny.from('achievements').insert(achInserts)
    if (achErr) console.error('[settlement] achievements insert failed', achErr)
  }

  const byLevel: Record<string, string[]> = {}
  for (const u of levelUpdates) {
    (byLevel[u.level] ??= []).push(u.id)
  }
  await Promise.all(
    Object.entries(byLevel).map(([lvl, ids]) =>
      dbAny.from('members').update({ level: lvl, next_level: null }).in('id', ids)
    )
  )

  // 清理 exempted 成員的 stale monthly_summary 列（如先前 buggy 月結遺留）
  if (exempted.length > 0) {
    const { error: delErr } = await dbAny.from('monthly_summary')
      .delete()
      .eq('year_month', yearMonth)
      .in('member_id', exempted.map(e => e.id))
    if (delErr) console.error('[settlement] exempted cleanup failed', delErr)
  }

  return { yearMonth, results, exempted: exempted.map(e => ({ name: e.name })) }
}
