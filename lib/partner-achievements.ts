// ============================================================
// 夥伴系統成就觸發 helper（4 類共 9 個成就）
//
// 設計原則：
//   - 純查詢 + insert，不重新計算現有 44 個基礎成就
//   - 單次提交可能多次觸發；以 UNIQUE(member_id, code) 防重複
//   - 任意失敗 console.error，不阻擋主流程（成就為附加）
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { ACHIEVEMENT_LIST } from './constants'
import { calcMonthStats, calcPartnerSyncStreak } from './scoring'
import { RECORD_COLS_STATS, MEMBER_COLS_STATS } from './db-columns'
import type { CheckInRecord, Member } from '@/types'

type DB = SupabaseClient

interface AchievementInsert { member_id: string; code: string }

/** 取一位成員的目前 accepted 夥伴 ID 清單 */
async function getAcceptedPartnerIds(db: DB, memberId: string): Promise<string[]> {
  const { data } = await db.from('partner_requests')
    .select('requester_id, target_id')
    .or(`requester_id.eq.${memberId},target_id.eq.${memberId}`)
    .eq('status', 'accepted')
  const rows = (data ?? []) as { requester_id: string; target_id: string }[]
  return rows.map(r => r.requester_id === memberId ? r.target_id : r.requester_id)
}

/** 取得指定成員已解鎖的成就 code Set */
async function getUnlockedCodes(db: DB, memberId: string): Promise<Set<string>> {
  const { data } = await db.from('achievements').select('code').eq('member_id', memberId)
  return new Set(((data ?? []) as { code: string }[]).map(r => r.code))
}

/** 插入成就（UNIQUE 防重複；失敗只 log） */
async function insertAchievements(db: DB, rows: AchievementInsert[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await db.from('achievements').insert(rows)
  if (error && (error as { code?: string }).code !== '23505') {
    console.error('[partner-achievements] insert failed', error)
  }
}

// ──────────────────────────────────────────────────────────────
// 社交類：PARTNER_FIRST / PARTNER_3 / PARTNER_5
// ──────────────────────────────────────────────────────────────

/**
 * 接受邀請後，雙方都可能解鎖社交類成就（依各自 accepted 數）。
 * 回傳「呼叫者（accepter）」新解鎖的成就清單，供 UI popup。
 */
export async function awardOnAccept(
  db: DB,
  accepterId: string,
  requesterId: string,
): Promise<{ code: string; name: string; badge: string }[]> {
  const acceptorUnlocks = await awardSocialFor(db, accepterId)
  await awardSocialFor(db, requesterId)
  return acceptorUnlocks
}

async function awardSocialFor(
  db: DB,
  memberId: string,
): Promise<{ code: string; name: string; badge: string }[]> {
  const partnerIds = await getAcceptedPartnerIds(db, memberId)
  const count = partnerIds.length
  if (count === 0) return []

  const unlocked = await getUnlockedCodes(db, memberId)
  const toAdd: AchievementInsert[] = []
  const triggered: { code: string; name: string; badge: string }[] = []

  for (const { target, code } of [
    { target: 1, code: 'PARTNER_FIRST' },
    { target: 3, code: 'PARTNER_3' },
    { target: 5, code: 'PARTNER_5' },
  ]) {
    if (count >= target && !unlocked.has(code)) {
      toAdd.push({ member_id: memberId, code })
      const def = ACHIEVEMENT_LIST.find(a => a.code === code)
      triggered.push({ code, name: def?.name ?? code, badge: def?.badge ?? 'Trophy' })
    }
  }
  await insertAchievements(db, toAdd)
  return triggered
}

// ──────────────────────────────────────────────────────────────
// 競爭 + 同步類：PARTNER_BEAT_RATE / PARTNER_BEAT_STREAK / PARTNER_SYNC_7 / PARTNER_SYNC_30
// ──────────────────────────────────────────────────────────────

const SYNC_WINDOW = 105

/**
 * 打卡提交後，比較我與所有夥伴的本月達成率、punch_streak、同步打卡天數。
 * 回傳新解鎖成就（已 insert 完成）。
 */
export async function awardOnCheckin(
  db: DB,
  me: Member,
  today: string,
  myTodayRec: CheckInRecord,
  myMonthRecords: CheckInRecord[],
): Promise<{ code: string; name: string; badge: string }[]> {
  const partnerIds = await getAcceptedPartnerIds(db, me.id)
  if (partnerIds.length === 0) return []

  const unlocked  = await getUnlockedCodes(db, me.id)
  const myStats   = calcMonthStats(me, myMonthRecords, today)
  const myStreak  = myTodayRec.punch_streak ?? 0
  const myMonth   = today.substring(0, 7) + '-01'

  // 批次取夥伴的成員資料 + 本月打卡 + 最近 105 日打卡（供 sync streak）
  const windowStart = new Date(Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)) - (SYNC_WINDOW - 1),
  )).toISOString().slice(0, 10)

  const [membersRes, recordsRes] = await Promise.all([
    db.from('members').select(MEMBER_COLS_STATS).in('id', partnerIds),
    db.from('checkin_records').select(RECORD_COLS_STATS)
      .in('member_id', partnerIds)
      .gte('date', windowStart)
      .lte('date', today)
      .order('date'),
  ])
  const partners = (membersRes.data ?? []) as Member[]
  const records  = (recordsRes.data ?? []) as CheckInRecord[]

  const recsByMid: Record<string, CheckInRecord[]> = {}
  for (const r of records) (recsByMid[r.member_id] ||= []).push(r)

  // 我的最近 105 日打卡日期集合（含今日剛 insert 的）
  const { data: myWindowRaw } = await db.from('checkin_records')
    .select('date').eq('member_id', me.id).gte('date', windowStart).lte('date', today)
  const myDates = new Set(((myWindowRaw ?? []) as { date: string }[]).map(r => r.date))
  myDates.add(today) // 確保今日在集合內（剛提交可能尚未對 SELECT 可見）

  let beatRate = false
  let beatStreak = false
  let maxSync = 0

  for (const p of partners) {
    const pRecs = recsByMid[p.id] ?? []
    const pMonthRecs = pRecs.filter(r => r.date >= myMonth)
    const pStats = calcMonthStats(p, pMonthRecs, today)
    if (myStats.rate > pStats.rate)            beatRate = true
    const pStreak = pRecs[pRecs.length - 1]?.punch_streak ?? 0
    if (myStreak > pStreak && myStreak > 0)    beatStreak = true

    const pDates = new Set(pRecs.map(r => r.date))
    const sync = calcPartnerSyncStreak(myDates, pDates, today, SYNC_WINDOW)
    if (sync > maxSync) maxSync = sync
  }

  const toAdd: AchievementInsert[] = []
  const triggered: { code: string; name: string; badge: string }[] = []
  function tryAward(code: string, condition: boolean) {
    if (!condition || unlocked.has(code)) return
    toAdd.push({ member_id: me.id, code })
    const def = ACHIEVEMENT_LIST.find(a => a.code === code)
    triggered.push({ code, name: def?.name ?? code, badge: def?.badge ?? 'Trophy' })
  }
  tryAward('PARTNER_BEAT_RATE',   beatRate)
  tryAward('PARTNER_BEAT_STREAK', beatStreak)
  tryAward('PARTNER_SYNC_7',  maxSync >= 7)
  tryAward('PARTNER_SYNC_30', maxSync >= 30)

  await insertAchievements(db, toAdd)
  return triggered
}

// ──────────────────────────────────────────────────────────────
// 鼓勵類：PARTNER_CHEER_10（送出 ≥10）/ PARTNER_CHEERED_10（收到 ≥10）
// ──────────────────────────────────────────────────────────────

/**
 * 送出鼓勵後：
 *   - 我（from）累積送出 ≥10 → 解 PARTNER_CHEER_10
 *   - 對方（to）累積收到 ≥10 → 解 PARTNER_CHEERED_10（靜默 insert，不回傳給呼叫者）
 *
 * 只回傳「呼叫者」新解鎖的清單。
 */
export async function awardOnEncourage(
  db: DB,
  fromId: string,
  toId: string,
): Promise<{ code: string; name: string; badge: string }[]> {
  // 並行查兩端累積與已解鎖
  const [sentCntRes, rcvCntRes, fromUnlocked, toUnlocked] = await Promise.all([
    db.from('encouragements').select('id', { count: 'exact', head: true }).eq('from_id', fromId),
    db.from('encouragements').select('id', { count: 'exact', head: true }).eq('to_id',   toId),
    getUnlockedCodes(db, fromId),
    getUnlockedCodes(db, toId),
  ])

  const sentCount = sentCntRes.count ?? 0
  const rcvCount  = rcvCntRes.count  ?? 0

  const toAdd: AchievementInsert[] = []
  const triggered: { code: string; name: string; badge: string }[] = []

  if (sentCount >= 10 && !fromUnlocked.has('PARTNER_CHEER_10')) {
    toAdd.push({ member_id: fromId, code: 'PARTNER_CHEER_10' })
    const def = ACHIEVEMENT_LIST.find(a => a.code === 'PARTNER_CHEER_10')
    triggered.push({
      code:  'PARTNER_CHEER_10',
      name:  def?.name  ?? 'PARTNER_CHEER_10',
      badge: def?.badge ?? 'Trophy',
    })
  }
  if (rcvCount >= 10 && !toUnlocked.has('PARTNER_CHEERED_10')) {
    toAdd.push({ member_id: toId, code: 'PARTNER_CHEERED_10' })
    // 對方解鎖不回傳給呼叫者
  }

  await insertAchievements(db, toAdd)
  return triggered
}
