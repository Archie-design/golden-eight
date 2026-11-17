// ============================================================
// 黃金八套餐 — 每日狀態快照與變化事件（純函式，無副作用）
// ============================================================

import { calcMonthStats, type PaceQuadrant } from './scoring'
import { LEVEL_THRESHOLDS, LONG_ABSENCE_DAYS } from './constants'
import type { Member, CheckInRecord } from '@/types'

/** 單一成員在某邏輯日的狀態快照 */
export interface DailyStatus {
  member_id:   string
  missed:      boolean
  miss_streak: number
  rate:        number
  passing:     boolean
  is_leave:    boolean   // 該日是否請假（如同該日不存在：不計漏卡、miss_streak 不累進）
}

export type StatusEventType =
  | 'miss_start'      // 開始缺卡
  | 'return'          // 回歸
  | 'drop_below'      // 跌破門檻
  | 'back_above'      // 回到門檻
  | 'long_absence'    // 轉入長期缺席

export interface StatusEvent {
  type:       StatusEventType
  member_id:  string
  name:       string
  /** 事件當下的連續缺卡天數（缺卡類事件用） */
  missStreak: number
  /** 事件當下的達成率（門檻類事件用） */
  rate:       number
  /** 跌破/回到門檻時的前一日達成率，供顯示「62%→58%」 */
  prevRate:   number
}

/** 該成員在指定邏輯日是否已開始計分（起算日未到 → 不算漏卡） */
export function hasStarted(member: Member, date: string): boolean {
  const startStr = member.effective_start_date ?? member.join_date
  return date >= startStr
}

/**
 * 建立指定邏輯日的全員狀態快照。
 *
 * - 起算日未到的成員不產生列（不是漏卡，是還沒加入；與工時分母、計分分母同源規則）
 * - `rate` / `passing` / `is_leave` 為當下事實，呼叫端寫入後不得因日後補登/月結而重算
 * - `miss_streak` 由前一日快照累進；前一日無快照則從 0 起算
 * - 請假日比照「如同該日不存在」：`missed = false`（不計漏卡），`miss_streak` 延續前一日數值
 *   （不累進也不歸零）——歸零會洗白正在累積的長期缺席記錄，累進則違反「請假不算漏卡」
 *
 * @param members       活躍成員
 * @param recordsByMember 該月（至該邏輯日）每位成員的打卡紀錄
 * @param prevByMember  前一邏輯日的快照（首日可為空物件）
 * @param date          目標邏輯日 'YYYY-MM-DD'
 */
export function buildDailySnapshot(
  members: Member[],
  recordsByMember: Record<string, CheckInRecord[]>,
  prevByMember: Record<string, DailyStatus>,
  date: string,
  leaveByMember?: Record<string, Set<string>>,   // 請假日從分母移除；亦用於漏卡/miss_streak 判定
): DailyStatus[] {
  const out: DailyStatus[] = []

  for (const m of members) {
    if (!hasStarted(m, date)) continue

    const records  = recordsByMember[m.id] ?? []
    const hasToday = records.some(r => r.date === date)
    const isLeave  = leaveByMember?.[m.id]?.has(date) ?? false
    const prev     = prevByMember[m.id]

    const missed      = !hasToday && !isLeave
    const miss_streak = isLeave
      ? (prev?.miss_streak ?? 0)               // 請假：延續前一日，不累進不歸零
      : hasToday
        ? 0
        : (prev?.miss_streak ?? 0) + 1

    // 當下事實：以該邏輯日為基準日計算累計月達成率與是否達標
    const stats     = calcMonthStats(m, records, date, leaveByMember?.[m.id])
    const threshold = LEVEL_THRESHOLDS[m.level] ?? 0.6
    const passing   = stats.maxScore > 0 && stats.rate >= threshold * 100

    out.push({ member_id: m.id, missed, miss_streak, rate: stats.rate, passing, is_leave: isLeave })
  }

  return out
}

/**
 * 比對前後兩日快照，產生狀態變化事件。
 *
 * 核心規則：`miss_streak` 由 N 累進至 N+1 **不產生事件** —— 只有跨越邊界才是事件。
 * 這是防止長期未打卡者每日重複觸發、造成告警疲乏的機制。
 *
 * 首日（`prevByMember` 為空）不產生任何事件，避免全員被判為「新事件」而爆量。
 */
export function diffStatusEvents(
  prevByMember: Record<string, DailyStatus>,
  curr: DailyStatus[],
  nameById: Record<string, string>,
): StatusEvent[] {
  if (Object.keys(prevByMember).length === 0) return []

  const events: StatusEvent[] = []

  for (const c of curr) {
    const p = prevByMember[c.member_id]
    if (!p) continue   // 該成員首次出現（如起算日剛到）→ 無前態可比，不報事件

    const base = {
      member_id:  c.member_id,
      name:       nameById[c.member_id] ?? c.member_id,
      missStreak: c.miss_streak,
      rate:       c.rate,
      prevRate:   p.rate,
    }

    // 缺卡狀態轉移；請假不算「回歸」——成員只是這天有正當理由，並未實際回來打卡
    if (!p.missed && c.missed)                   events.push({ ...base, type: 'miss_start' })
    else if (p.missed && !c.missed && !c.is_leave) events.push({ ...base, type: 'return' })

    // 跨越長期缺席門檻（僅在跨界當日觸發一次；其後累進不再報）
    if (p.miss_streak < LONG_ABSENCE_DAYS && c.miss_streak >= LONG_ABSENCE_DAYS) {
      events.push({ ...base, type: 'long_absence' })
    }

    // 門檻狀態轉移
    if (p.passing && !c.passing)      events.push({ ...base, type: 'drop_below' })
    else if (!p.passing && c.passing) events.push({ ...base, type: 'back_above' })
  }

  return events
}

// EVENT_LABEL（跨成員事件文案）已隨 personal-digest-review 變更移除，
// diffStatusEvents 本身保留不刪供日後若群組重新擴編多人使用時參考。

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${String(d).padStart(2, '0')}(${WEEKDAY[dow]})`
}

/**
 * 組出 LINE 純文字摘要——單一使用者的個人復盤（群組已合併，系統僅剩 M001 一人使用）。
 *
 * 版面：今日打卡狀況 → 本月累計 → 連續打拳 → 今日 vs 上月同天 → 今日 vs 歷史累積平均 → 追蹤軌道
 *
 * 舊版的全員摘要格式（漏卡名單、門檻風險四象限、長期缺席摺疊、狀態變化事件、全員平均）
 * 已隨 personal-digest-review 變更移除——那些是跨成員比較概念，單人情境下沒有意義。
 * `buildDailySnapshot`/`diffStatusEvents` 本身保留不刪，供日後若群組重新擴編多人使用時參考，
 * 但本函式不再呼叫 `diffStatusEvents` 的輸出。
 */
const TASK_NAMES = ['早睡早起', '破曉打拳', '丹氣跑步', '曬太陽', '工作8小時', '不吃肉', '寫觀心書', '淨心功法']

export interface TodayStatus {
  tasks: boolean[] | null   // 當日 8 項任務完成狀態；無打卡紀錄為 null
  score: number | null      // 當日得分；無打卡紀錄為 null
  isLeave: boolean
  leaveReason?: string
}

export interface MonthStatsLike {
  totalScore: number
  maxScore:   number
  rate:       number
  targetScore: number
  remaining:  number
}

export interface PaceStatusLike {
  pace:     number
  projRate: number
  quadrant: PaceQuadrant
}

export function formatDigestMessage(
  date: string,
  today: TodayStatus,
  monthStats: MonthStatsLike,
  punchStreak: number,
  paceStatus: PaceStatusLike,
  lastMonthRate: number | null,        // 上月同一天的達成率；上月無資料為 null
  historicalAvgRate: number | null,    // 歷史累積平均同一天的達成率；無歷史資料為 null
): string {
  const L: string[] = []
  L.push(`📋 黃金八套餐 · ${formatDateLabel(date)} 已截止`)
  L.push('')

  // 今日打卡狀況
  L.push('✅ 今日打卡狀況')
  if (today.isLeave) {
    L.push(`　今日已請假${today.leaveReason ? `（${today.leaveReason}）` : ''}`)
  } else if (today.tasks === null) {
    L.push('　今日未打卡')
  } else {
    const doneNames = TASK_NAMES.filter((_, i) => today.tasks![i])
    const undoneNames = TASK_NAMES.filter((_, i) => !today.tasks![i])
    L.push(`　得分：${today.score} 分`)
    L.push(`　完成：${doneNames.length > 0 ? doneNames.join('、') : '（無）'}`)
    if (undoneNames.length > 0) L.push(`　未完成：${undoneNames.join('、')}`)
  }
  L.push('')

  // 本月累計
  L.push('📊 本月累計')
  L.push(`　累計得分 ${monthStats.totalScore} / ${monthStats.maxScore}　達成率 ${monthStats.rate}%`)
  L.push(`　距目標差 ${monthStats.remaining > 0 ? `-${monthStats.remaining}` : '已達標 ✓'}（目標 ${monthStats.targetScore} 分）`)
  L.push('')

  // 連續打拳
  L.push(`🥊 連續打拳 ${punchStreak} 天`)
  L.push('')

  // 今日達成率：未打卡或請假時沒有分數可比，不可顯示誤導性的 0%
  const todayRate = today.score !== null ? Math.round((today.score / 8) * 100) : null

  // 今日 vs 上月同一天
  L.push('📅 今日 vs 上月同一天')
  if (todayRate === null) {
    L.push('　今日尚無打卡紀錄，無法比較')
  } else {
    L.push(lastMonthRate === null ? '　上月無資料' : `　今日 ${todayRate}%　上月同天 ${lastMonthRate}%`)
  }
  L.push('')

  // 今日 vs 歷史累積平均
  L.push('📈 今日 vs 歷史累積平均')
  if (todayRate === null) {
    L.push('　今日尚無打卡紀錄，無法比較')
  } else {
    L.push(historicalAvgRate === null ? '　暫無歷史資料' : `　今日 ${todayRate}%　歷史平均 ${historicalAvgRate}%`)
  }
  L.push('')

  // 追蹤軌道
  const QUADRANT_LABEL: Record<PaceQuadrant, string> = {
    safe: '✅ 穩健', lukewarm: '🟠 溫水', slow_start: '🟡 起步慢', rescue: '🔴 要救', exempt: '—',
  }
  L.push('🎯 追蹤軌道（照近期速度預估月底）')
  L.push(`　${QUADRANT_LABEL[paceStatus.quadrant]}　月底預估 ${paceStatus.projRate}%（目前進度 ${paceStatus.pace}%）`)

  return L.join('\n')
}
