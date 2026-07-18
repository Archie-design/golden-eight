// ============================================================
// 黃金八套餐 — 每日狀態快照與變化事件（純函式，無副作用）
// ============================================================

import { calcMonthStats, calcPaceStatus, type PaceQuadrant } from './scoring'
import { LEVEL_THRESHOLDS, LONG_ABSENCE_DAYS } from './constants'
import type { Member, CheckInRecord } from '@/types'

/** 單一成員在某邏輯日的狀態快照 */
export interface DailyStatus {
  member_id:   string
  missed:      boolean
  miss_streak: number
  rate:        number
  passing:     boolean
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
 * - `rate` / `passing` 為當下事實，呼叫端寫入後不得因日後補登/月結而重算
 * - `miss_streak` 由前一日快照累進；前一日無快照則從 0 起算
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
): DailyStatus[] {
  const out: DailyStatus[] = []

  for (const m of members) {
    if (!hasStarted(m, date)) continue

    const records  = recordsByMember[m.id] ?? []
    const hasToday = records.some(r => r.date === date)
    const prev     = prevByMember[m.id]

    const missed      = !hasToday
    const miss_streak = hasToday ? 0 : (prev?.miss_streak ?? 0) + 1

    // 當下事實：以該邏輯日為基準日計算累計月達成率與是否達標
    const stats     = calcMonthStats(m, records, date)
    const threshold = LEVEL_THRESHOLDS[m.level] ?? 0.6
    const passing   = stats.maxScore > 0 && stats.rate >= threshold * 100

    out.push({ member_id: m.id, missed, miss_streak, rate: stats.rate, passing })
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

    // 缺卡狀態轉移
    if (!p.missed && c.missed)      events.push({ ...base, type: 'miss_start' })
    else if (p.missed && !c.missed) events.push({ ...base, type: 'return' })

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

const EVENT_LABEL: Record<StatusEventType, (e: StatusEvent) => string> = {
  miss_start:   e => `🔴 ${e.name} 開始缺卡（連 ${e.missStreak} 天）`,
  return:       e => `✨ ${e.name} 回來了！`,
  drop_below:   e => `⚠️ ${e.name} 跌破門檻 ${e.prevRate}%→${e.rate}%`,
  back_above:   e => `🎉 ${e.name} 回到門檻 ${e.prevRate}%→${e.rate}%`,
  long_absence: e => `💤 ${e.name} 轉入長期缺席（連 ${e.missStreak} 天）`,
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${String(d).padStart(2, '0')}(${WEEKDAY[dow]})`
}

/**
 * 組出 LINE 純文字摘要。
 *
 * 版面：⚡變化 → ❌漏卡 → 🎯門檻風險 → 💤長期缺席摺疊 → ✅總結
 * 長期缺席者（miss_streak >= LONG_ABSENCE_DAYS）從漏卡/風險明細移除，摺疊為單行。
 * 管理員自身不排除——管理員同時是學員，其漏卡與風險照常列入。
 */
// 四象限在日報的呈現：只列 🔴 rescue / 🟠 lukewarm（要救 + 溫水）。
const QUADRANT_DIGEST: Partial<Record<PaceQuadrant, string>> = {
  rescue:   '🔴',
  lukewarm: '🟠',
}

export function formatDigestMessage(
  snapshot: DailyStatus[],
  events: StatusEvent[],
  nameById: Record<string, string>,
  levelById: Record<string, string>,
  date: string,
  membersById: Record<string, Member>,
  recordsByMember: Record<string, CheckInRecord[]>,
): string {
  const nm = (id: string) => nameById[id] ?? id
  const total = snapshot.length

  const longAbsent = snapshot.filter(s => s.miss_streak >= LONG_ABSENCE_DAYS)
  const longIds    = new Set(longAbsent.map(s => s.member_id))

  const missed = snapshot.filter(s => s.missed && !longIds.has(s.member_id))
  const done   = snapshot.filter(s => !s.missed)

  // 門檻風險改用二維四象限（與後台一致）：即時算 pace，只列 🔴 要救 / 🟠 溫水。
  // pace 為當下呈現值、非留存事實，故不進 DailyStatus/DB，於此就地計算。
  type RiskRow = { id: string; mark: string; projRate: number; order: number }
  const atRisk: RiskRow[] = []
  for (const s of snapshot) {
    if (longIds.has(s.member_id)) continue
    const m = membersById[s.member_id]
    if (!m) continue
    const stats = calcMonthStats(m, recordsByMember[m.id] ?? [], date)
    const ps    = calcPaceStatus(m, stats, recordsByMember[m.id] ?? [], date, date.substring(0, 7))
    const mark  = QUADRANT_DIGEST[ps.quadrant]
    if (!mark) continue   // 只保留 rescue / lukewarm
    atRisk.push({ id: s.member_id, mark, projRate: ps.projRate, order: ps.quadrant === 'rescue' ? 0 : 1 })
  }
  atRisk.sort((a, b) => a.order - b.order || a.projRate - b.projRate)   // 🔴 先、預估低者先

  const avg = total > 0
    ? Math.round(snapshot.reduce((sum, s) => sum + s.rate, 0) / total)
    : 0

  const L: string[] = []
  L.push(`📋 黃金八套餐 · ${formatDateLabel(date)} 已截止`)
  L.push('')

  L.push('⚡ 今日變化')
  if (events.length === 0) {
    L.push('　（無異動）')
  } else {
    for (const e of events) L.push(`　${EVENT_LABEL[e.type](e)}`)
  }
  L.push('')

  L.push(`❌ 漏卡 ${missed.length}/${total}`)
  if (missed.length === 0) {
    L.push('　（無）')
  } else {
    for (const s of missed) {
      const streak = s.miss_streak > 1 ? `連 ${s.miss_streak} 天` : '單日'
      L.push(`　${nm(s.member_id)}　${streak}`)
    }
  }
  L.push('')

  if (atRisk.length > 0) {
    L.push('🎯 門檻風險（照近期速度預估月底）')
    for (const r of atRisk) {
      const lv  = levelById[r.id] ?? ''
      const thr = Math.round((LEVEL_THRESHOLDS[lv] ?? 0.6) * 100)
      L.push(`　${r.mark} ${nm(r.id)}　月底預估 ${r.projRate}%（需 ${thr}%）`)
    }
    L.push('')
  }

  if (longAbsent.length > 0) {
    L.push(`💤 長期缺席 ${longAbsent.length} 人（${longAbsent.map(s => nm(s.member_id)).join('・')}）`)
    L.push('')
  }

  L.push(`✅ ${done.length} 人完成 · 全月均 ${avg}%`)

  return L.join('\n')
}
