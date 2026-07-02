import { getMonthEnd } from './api-helper'
import {
  calcMonthStats, calcMaxPunchStreakFromSorted, calcPenalty,
  calcMonthlyAchievements, calcWorkHoursDeduction, isDawnKing,
} from './scoring'
import { countWorkingDays, fetchWeekdayHolidaySet } from './working-days'
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
 *
 * 對所有非停用成員（含新進豁免 maxScore=0 者）寫 monthly_summary 列：
 *   - 一般成員：完整統計 + chose_next_level snapshot
 *   - 新進豁免：stub 列（max_score=0、其他統計值為 0/false） + chose_next_level snapshot
 * chose_next_level 在月結套用 next_level 「之前」記錄該成員的 next_level 是否非 NULL。
 * next_level 套用 + 清空 涵蓋所有非停用成員（含豁免）。
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

  const [recsRes, achRes, whHolidaySet, pastSummariesRes] = await Promise.all([
    dbAny.from('checkin_records').select(RECORD_COLS_SETTLEMENT)
      .in('member_id', memberIds)
      .gte('date', monthStartStr).lte('date', monthEndStr)
      .order('date'),
    dbAny.from('achievements').select('member_id, code')
      .in('member_id', memberIds),
    // 工時補扣窗口內落在平日的假日集合；per-member 工作日在迴圈中以此純記憶體計算，
    // 讓分母能依各自 effective_start_date 縮減（避免對每人各發一次假日查詢）。
    whWindowStart > monthEndStr
      ? Promise.resolve(new Set<string>())
      : fetchWeekdayHolidaySet(whWindowStart, monthEndStr, dbAny),
    // BUG fix：排除當前結算月，避免重跑時把本月的 passing 重複計入累計通關次數
    // （下方 passingCount 會再 +1 當月），否則 MONTH_STREAK 成就在重跑時提早觸發。
    dbAny.from('monthly_summary').select('member_id, passing')
      .in('member_id', memberIds).neq('year_month', yearMonth),
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

  for (const m of memberList) {
    const records = recsByMember[m.id] ?? []
    const stats   = calcMonthStats(m, records, refDate)

    // chose_next_level snapshot：套用前先記錄
    const choseNextLevel = m.next_level != null

    // 新進成員 maxScore=0：寫 stub 列僅記錄 chose_next_level，不觸發成就
    if (stats.maxScore === 0) {
      summaryRows.push({
        member_id:            m.id,
        year_month:           yearMonth,
        total_score:          0,
        max_score:            0,
        rate:                 0,
        passing:              false,
        penalty:              0,
        max_streak:           0,
        is_dawn_king:         false,
        work_hours_deduction: 0,
        chose_next_level:     choseNextLevel,
        settled_at:           new Date().toISOString(),
      })
      if (m.next_level) levelUpdates.push({ id: m.id, level: m.next_level })
      exempted.push({ id: m.id, name: m.name })
      continue
    }

    const maxStreak       = calcMaxPunchStreakFromSorted(records)
    const memberIsDawnKing = isDawnKing(m, records, yearMonth, refDate)

    // 工時補扣窗口起點：在群組窗口（4 月限 4/29；5 月起月初）之上，再以個人起算日縮減，
    // 讓月中新進成員的工時分母只計其實際在職的工作日（對齊 calcMonthStats 的分數分母）。
    const memberStart  = m.effective_start_date ?? m.join_date
    const memberWhStart = memberStart > whWindowStart ? memberStart : whWindowStart
    const whWorkingDays = countWorkingDays(memberWhStart, monthEndStr, whHolidaySet)
    const totalWorkHours = records
      .filter(r => r.date >= memberWhStart)
      .reduce((s, r) => {
        const wh = (r as CheckInRecord & { work_hours?: number | null }).work_hours
        return s + (wh != null ? wh : r.tasks[4] ? 8 : 0)
      }, 0)
    const whDeduction = calcWorkHoursDeduction(totalWorkHours, whWorkingDays)

    // 工時補扣可能超過實得分數；夾在 0 以下限，避免負分 / 負達成率寫入 monthly_summary
    // 與傳播到排行榜、進度頁（顯示負百分比）。
    const adjustedTotal   = Math.max(0, stats.totalScore - whDeduction)
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
      chose_next_level:     choseNextLevel,
      settled_at:           new Date().toISOString(),
    })

    const passingCount    = (passCountByMember[m.id] ?? 0) + (adjustedPassing ? 1 : 0)
    const totalReachedMax = stats.maxScore > 0 && adjustedTotal >= stats.maxScore
    const monthAchs = calcMonthlyAchievements(
      adjustedPassing,
      m.level,
      codesByMember[m.id] ?? [],
      passingCount,
      totalReachedMax,
    )
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

  return { yearMonth, results, exempted: exempted.map(e => ({ name: e.name })) }
}
