// ============================================================
// 黃金八套餐 — 得分與成就計算（純函式，無副作用）
// ============================================================

import { CheckInRecord, Member } from '@/types'
import { ACHIEVEMENT_LIST, LEVEL_PENALTIES, LEVEL_THRESHOLDS } from './constants'

// ─── 得分計算 ─────────────────────────────────────────────────

export function calcBaseScore(tasks: boolean[]): number {
  return tasks.filter(Boolean).length
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
  const joinDate    = new Date(member.join_date + 'T00:00:00+08:00')
  const effectiveStart = joinDate > monthStart ? joinDate : monthStart

  // 本月最後一天（UTC+8）
  const [y, mo] = yearMonth.split('-').map(Number)
  const lastDay = new Date(y, mo, 0).getDate()
  const monthEndDate = new Date(`${yearMonth}-${String(lastDay).padStart(2, '0')}T00:00:00+08:00`)

  // 從 effectiveStart 到月底（含）的完整天數 → 月底目標的基準
  const fullMonthDays = Math.max(
    0,
    Math.floor((monthEndDate.getTime() - effectiveStart.getTime()) / 86400000) + 1
  )
  const maxScore   = fullMonthDays * 8
  const totalScore = records.reduce((s, r) => s + r.total_score, 0)
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
    const d = new Date(checkDate + 'T00:00:00+08:00')
    d.setDate(d.getDate() - 1)
    checkDate = d.toISOString().slice(0, 10)
  }
  return streak
}

// ─── 月最長連續打拳天數 ────────────────────────────────────────

export function calcMaxPunchStreak(records: CheckInRecord[]): number {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
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

export function calcNewAchievements(
  allRecords: CheckInRecord[],          // 含今日，已排序升序
  todayRecord: CheckInRecord,
  alreadyUnlocked: string[]
): AchievementTrigger[] {
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

  // 第一次打卡
  if (allRecords.length === 1) award('FIRST_CHECKIN')

  // 今日完美
  if (todayRecord.base_score === 8) award('DAILY_PERFECT')
  if (todayRecord.total_score >= 8.5) award('DAILY_PERFECT_BONUS')

  // 累積打卡天數
  const ciCount = allRecords.length
  for (const { target, code } of [
    { target: 30,  code: 'CHECKIN_30'  },
    { target: 100, code: 'CHECKIN_100' },
    { target: 365, code: 'CHECKIN_365' },
  ]) {
    if (ciCount >= target) award(code)
  }

  // 累積大滿貫次數
  const perfectCount = allRecords.filter(r => r.base_score === 8).length
  for (const { target, code } of [
    { target: 10, code: 'PERFECT_10' },
    { target: 30, code: 'PERFECT_30' },
  ]) {
    if (perfectCount >= target) award(code)
  }

  // 各任務連續天數
  const sorted = [...allRecords].sort((a, b) => a.date.localeCompare(b.date))
  for (let taskIdx = 0; taskIdx < 8; taskIdx++) {
    const streak = calcTaskStreak(sorted, taskIdx, todayRecord.date)
    ACHIEVEMENT_LIST
      .filter(a => a.type === 'streak' && (a as { task?: number }).task === taskIdx)
      .forEach(ach => {
        const days = (ach as { days?: number }).days ?? 0
        if (streak >= days) award(ach.code)
      })
  }

  return newOnes
}

/** 月結後成就（月通關、黃金、完美月、連勝）*/
export function calcMonthlyAchievements(
  passing: boolean,
  rate: number,
  level: string,
  alreadyUnlocked: string[]
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
  if (rate >= 100)                  award('MONTH_PERFECT')

  const passCount = alreadyUnlocked.filter(c => c === 'MONTH_PASS').length + 1
  if (passCount >= 3) award('MONTH_STREAK_3')
  if (passCount >= 6) award('MONTH_STREAK_6')

  return newOnes
}
