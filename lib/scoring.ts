// ============================================================
// 黃金八套餐 — 得分與成就計算（純函式，無副作用）
// ============================================================

import { CheckInRecord, Member } from '@/types'
import { ACHIEVEMENT_LIST, LEVEL_PENALTIES, LEVEL_THRESHOLDS } from './constants'

/**
 * base_score 在 DB 是 NUMERIC(3,1)，Supabase JS client 可能以字串回傳（如 "8.0"），
 * 直接用 `=== 8` 會 false。統一用此 helper 判定當日是否滿分（含 0.5 步進）。
 */
export function isBaseScorePerfect(score: number | string): boolean {
  return Number(score) === 8
}

// ─── 得分計算 ─────────────────────────────────────────────────

export function calcBaseScore(tasks: boolean[], earlySleepHalf = false): number {
  const count = tasks.filter(Boolean).length
  return (earlySleepHalf && tasks[0]) ? count - 0.5 : count
}

/** 連續打拳天數（加分機制已移除，連續紀錄供成就系統使用） */
export function calcPunchStreak(
  prevRecord: CheckInRecord | null,
  todayPunch: boolean
): number {
  if (!todayPunch) return 0
  if (!prevRecord) return 1
  return (prevRecord.tasks[1]
    ? (prevRecord as unknown as { punch_streak?: number }).punch_streak ?? 1
    : 0) + 1
}

// ─── 月進度計算 ────────────────────────────────────────────────

export function calcMonthStats(
  member: Member,
  records: CheckInRecord[],
  today: string
) {
  const yearMonth   = today.substring(0, 7)
  const monthStart  = new Date(yearMonth + '-01T00:00:00+08:00')
  // 優先用 effective_start_date；舊會員（NULL）fallback 到 join_date
  const startStr    = member.effective_start_date ?? member.join_date
  const startDate   = new Date(startStr + 'T00:00:00+08:00')
  const effectiveStart = startDate > monthStart ? startDate : monthStart

  // 本月最後一天（UTC+8）
  const [y, mo] = yearMonth.split('-').map(Number)
  const lastDay = new Date(y, mo, 0).getDate()
  const monthEndDate = new Date(`${yearMonth}-${String(lastDay).padStart(2, '0')}T00:00:00+08:00`)

  // 從 effectiveStart 到月底（含）的完整天數 → 月底目標的基準
  const fullMonthDays = Math.max(
    0,
    Math.floor((monthEndDate.getTime() - effectiveStart.getTime()) / 86400000) + 1
  )
  const maxScore        = fullMonthDays * 8
  const effectiveStartStr = startDate > monthStart ? startStr : yearMonth + '-01'
  const totalScore      = records
    .filter(r => r.date >= effectiveStartStr)
    .reduce((s, r) => s + r.total_score, 0)
  const rate       = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
  const threshold  = LEVEL_THRESHOLDS[member.level] ?? 0.6
  const targetScore = Math.ceil(maxScore * threshold)
  const remaining  = Math.max(0, targetScore - totalScore)
  const passing    = rate >= threshold * 100

  return { maxScore, totalScore, rate, targetScore, remaining, passing }
}

// ─── 任務連續天數 ──────────────────────────────────────────────

/** 從已排序（升序）紀錄中計算指定任務截至 endDate 的連續天數 */
export function calcTaskStreak(
  sortedRecords: CheckInRecord[],
  taskIdx: number,
  endDate: string
): number {
  let streak = 0
  let checkDate = endDate

  for (let i = sortedRecords.length - 1; i >= 0; i--) {
    const rec = sortedRecords[i]
    if (rec.date !== checkDate) break
    if (!rec.tasks[taskIdx]) break
    streak++
    // 純字串日期遞減一天：用 UTC 計算避免 timezone 偏移（toISOString() 永遠輸出 UTC）
    const [y, m, d] = checkDate.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d - 1))
    checkDate = dt.toISOString().slice(0, 10)
  }
  return streak
}

// ─── 破曉王判定 ────────────────────────────────────────────────

/**
 * 計算成員在指定月份的「應打卡天數」（從 effective_start_date 或 join_date 到 refDate）。
 * - refDate 為「當下台北日期」或「歷史月份的月底」
 * - 若起算日晚於 refDate（新進尚未開始），回傳 0
 */
export function expectedCheckinDays(member: Member, yearMonth: string, refDate: string): number {
  const startStr   = member.effective_start_date ?? member.join_date
  const monthStart = `${yearMonth}-01`
  const effectiveStartStr = startStr > monthStart ? startStr : monthStart
  if (effectiveStartStr > refDate) return 0
  const a = new Date(effectiveStartStr + 'T00:00:00+08:00')
  const b = new Date(refDate + 'T00:00:00+08:00')
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1
}

/**
 * 破曉王判定（三條件，統一定義；三個 call site 共用：settlement / leaderboard / progress）。
 * 成員必須同時滿足：
 *   1. expectedCheckinDays > 0（非新進豁免、活躍窗口已開始）
 *   2. records.length === expectedDays（活躍窗口零缺卡）
 *   3. 每筆紀錄 tasks[1] === true（每天都完成破曉打拳）
 *
 * refDate 由呼叫端傳入 min(today, monthEnd)：歷史月份對月底評估，本月對今日評估。
 * 因條件 2+3 已要求「窗口內每天都打拳」，破曉王天生即群組最長連打者，無需再比群組最大值。
 */
export function isDawnKing(
  member: Member,
  records: CheckInRecord[],
  yearMonth: string,
  refDate: string,
): boolean {
  const expectedDays = expectedCheckinDays(member, yearMonth, refDate)
  if (expectedDays <= 0) return false
  if (records.length !== expectedDays) return false
  return records.every(r => r.tasks[1] === true)
}

// ─── 月最長連續打拳天數 ────────────────────────────────────────

/**
 * 計算最長連續打拳天數。
 * @param records 已依 date 升序排序的紀錄；若不確定請改呼叫 calcMaxPunchStreak（會自動排序）。
 */
export function calcMaxPunchStreakFromSorted(sorted: CheckInRecord[]): number {
  let max = 0, cur = 0
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].tasks[1]) {
      cur++
      max = Math.max(max, cur)
    } else {
      cur = 0
    }
  }
  return max
}

/** Backward-compatible：呼叫端不確定排序時使用，內部會排序一次 */
export function calcMaxPunchStreak(records: CheckInRecord[]): number {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  return calcMaxPunchStreakFromSorted(sorted)
}

/**
 * 從 endDate 往回算最多 windowDays 天，找出我與夥伴「連續同日皆打卡」的天數。
 * 純函式，純字串日期算術（避免 timezone 偏移）。
 *
 * @param myDates       我有打卡記錄的日期 Set（'YYYY-MM-DD'）
 * @param partnerDates  夥伴有打卡記錄的日期 Set
 * @param endDate       'YYYY-MM-DD'（通常為今日邏輯日）
 * @param windowDays    最大窗口（一般 105 已足夠涵蓋 30 天門檻）
 */
export function calcPartnerSyncStreak(
  myDates: Set<string>,
  partnerDates: Set<string>,
  endDate: string,
  windowDays: number,
): number {
  let streak = 0
  let checkDate = endDate
  for (let i = 0; i < windowDays; i++) {
    if (!myDates.has(checkDate) || !partnerDates.has(checkDate)) break
    streak++
    const [y, m, d] = checkDate.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d - 1))
    checkDate = dt.toISOString().slice(0, 10)
  }
  return streak
}

// ─── 工作時數補扣計算 ───────────────────────────────────────────

/** 當月總工時不足（工作日×8小時）時，每少 8 小時扣 1 分 */
export function calcWorkHoursDeduction(
  totalWorkHours: number,
  workingDays: number
): number {
  const required = workingDays * 8
  const shortfall = Math.max(0, required - totalWorkHours)
  return Math.ceil(shortfall / 8)
}

// ─── 月結罰款計算 ──────────────────────────────────────────────

export function calcPenalty(level: string, passing: boolean): number {
  if (passing) return 0
  return LEVEL_PENALTIES[level] ?? 0
}

// ─── 成就解鎖計算 ──────────────────────────────────────────────

export interface AchievementTrigger {
  code: string
  name: string
  badge: string
}

/**
 * 依「聚合結果」計算新解鎖成就（審查報告 P2-15 重構）。
 * 呼叫端僅需提供彙總數字與最近 N 日的紀錄，不必每次 SELECT 全量紀錄。
 */
export function calcNewAchievementsFromAggregates(args: {
  totalCount:   number          // 含今日的總打卡天數
  perfectCount: number          // 含今日的大滿貫累計次數（base_score = 8）
  taskCounts:   number[]        // 每項任務累積完成次數（長度 8，含今日）
  recentSorted: CheckInRecord[] // 最近 N 日（N ≥ 7 足以支援 streak 3/7 成就），升序
  todayRecord:  CheckInRecord
  alreadyUnlocked: string[]
}): AchievementTrigger[] {
  const { totalCount, perfectCount, taskCounts, recentSorted, todayRecord, alreadyUnlocked } = args
  const unlocked = new Set(alreadyUnlocked)
  const newOnes: AchievementTrigger[] = []

  function award(code: string) {
    if (!unlocked.has(code)) {
      const ach   = ACHIEVEMENT_LIST.find(a => a.code === code)
      const name  = ach?.name  ?? code
      const badge = ach?.badge ?? 'Trophy'
      newOnes.push({ code, name, badge })
      unlocked.add(code)
    }
  }

  if (totalCount === 1)                       award('FIRST_CHECKIN')
  if (isBaseScorePerfect(todayRecord.base_score)) award('DAILY_PERFECT')

  for (const { target, code } of [
    { target: 30,  code: 'CHECKIN_30'  },
    { target: 100, code: 'CHECKIN_100' },
    { target: 365, code: 'CHECKIN_365' },
  ]) if (totalCount >= target) award(code)

  for (const { target, code } of [
    { target: 10, code: 'PERFECT_10' },
    { target: 30, code: 'PERFECT_30' },
  ]) if (perfectCount >= target) award(code)

  // 各任務天數成就
  //   - 3 / 7 天：streak（連續）— 用 calcTaskStreak
  //   - 30 / 100 天：cumulative（累積）— 用 taskCounts
  for (let taskIdx = 0; taskIdx < 8; taskIdx++) {
    const streak     = calcTaskStreak(recentSorted, taskIdx, todayRecord.date)
    const cumulative = taskCounts[taskIdx] ?? 0
    ACHIEVEMENT_LIST
      .filter(a => a.type === 'streak' && (a as { task?: number }).task === taskIdx)
      .forEach(ach => {
        const days  = (ach as { days?: number }).days ?? 0
        const mode  = (ach as { mode?: string }).mode ?? 'streak'
        const value = mode === 'cumulative' ? cumulative : streak
        if (value >= days) award(ach.code)
      })
  }

  return newOnes
}

/**
 * 編輯後成就對帳：算出應加入 / 撤銷的成就清單。
 *
 * 規則（保守，偏向尊重既有解鎖）：
 *   add    — 編輯後新達成而尚未解鎖（沿用 calcNewAchievementsFromAggregates）
 *   remove — 只撤可立即驗證為「已不再成立」的：
 *     · DAILY_PERFECT       → perfectCount === 0
 *     · PERFECT_10 / 30     → perfectCount < 10 / 30
 *   不撤銷的：FIRST_CHECKIN、CHECKIN_30/100/365（單調遞增）、T*_STREAK_*（視為歷史里程碑，
 *   即使最近 105 日無資料也保留），月度成就由 settlement 管理不在此處理。
 */
export function reconcileAchievementsAfterEdit(args: {
  totalCount:   number
  perfectCount: number
  taskCounts:   number[]
  recentSorted: CheckInRecord[]
  todayRecord:  CheckInRecord
  alreadyUnlocked: string[]
}): { add: AchievementTrigger[]; remove: string[] } {
  const add = calcNewAchievementsFromAggregates(args)
  const unlocked = new Set(args.alreadyUnlocked)
  const remove: string[] = []

  if (unlocked.has('DAILY_PERFECT') && args.perfectCount === 0) {
    remove.push('DAILY_PERFECT')
  }
  if (unlocked.has('PERFECT_10') && args.perfectCount < 10) remove.push('PERFECT_10')
  if (unlocked.has('PERFECT_30') && args.perfectCount < 30) remove.push('PERFECT_30')

  return { add, remove }
}

/** @deprecated 保留相容：等價於 calcNewAchievementsFromAggregates 的包裝 */
export function calcNewAchievements(
  allRecords: CheckInRecord[],
  todayRecord: CheckInRecord,
  alreadyUnlocked: string[]
): AchievementTrigger[] {
  const sorted = [...allRecords].sort((a, b) => a.date.localeCompare(b.date))
  const taskCounts = Array.from({ length: 8 }, (_, i) =>
    sorted.filter(r => r.tasks[i]).length,
  )
  return calcNewAchievementsFromAggregates({
    totalCount:      sorted.length,
    perfectCount:    sorted.filter(r => isBaseScorePerfect(r.base_score)).length,
    taskCounts,
    recentSorted:    sorted,
    todayRecord,
    alreadyUnlocked,
  })
}

/**
 * 月結後成就（月通關、黃金、完美月、連勝）。
 * @param passingCount   含本次月結的累計通關次數（由 settlement route 從 monthly_summary 計算後傳入）
 * @param totalReachedMax 當月實際分數是否達到 maxScore（用於 MONTH_PERFECT；
 *                        避免 rate 四捨五入到 100% 但實際還差 0.5 分）
 */
export function calcMonthlyAchievements(
  passing: boolean,
  level: string,
  alreadyUnlocked: string[],
  passingCount: number,
  totalReachedMax: boolean,
): AchievementTrigger[] {
  if (!passing) return []

  const unlocked = new Set(alreadyUnlocked)
  const newOnes: AchievementTrigger[] = []

  function award(code: string) {
    if (!unlocked.has(code)) {
      const ach   = ACHIEVEMENT_LIST.find(a => a.code === code)
      const name  = ach?.name  ?? code
      const badge = ach?.badge ?? 'Trophy'
      newOnes.push({ code, name, badge })
      unlocked.add(code)
    }
  }

  if (!unlocked.has('MONTH_PASS')) award('MONTH_PASS')
  if (level === '黃金戰士')         award('MONTH_GOLD')
  if (totalReachedMax)              award('MONTH_PERFECT')

  if (passingCount >= 3) award('MONTH_STREAK_3')
  if (passingCount >= 6) award('MONTH_STREAK_6')

  return newOnes
}
