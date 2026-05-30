import { NextResponse } from 'next/server'
import { getCurrentMember, getCheckinDayTaipei } from '@/lib/api-helper'
import { calcMonthStats } from '@/lib/scoring'
import { RECORD_COLS_STATS } from '@/lib/db-columns'
import { MEMBER_COLS_STATS } from '@/lib/db-columns'
import type { CheckInRecord, Member, PartnerCard } from '@/types'

/**
 * GET /api/partners
 * 回傳我所有 accepted 夥伴的清單 + 今日打卡快照 + 本月達成率 + 連續天數
 * + 我今天是否已鼓勵 + 是否收到對方今日的鼓勵。
 */
export async function GET() {
  const auth = await getCurrentMember()
  if (auth instanceof NextResponse) return auth
  const { member, db } = auth

  // 1. 取夥伴關係（單向記錄，OR 兩方向）
  const { data: relsRaw } = await db
    .from('partner_requests')
    .select('requester_id, target_id')
    .or(`requester_id.eq.${member.id},target_id.eq.${member.id}`)
    .eq('status', 'accepted')
  const rels = (relsRaw ?? []) as { requester_id: string; target_id: string }[]
  const partnerIds = rels.map(r => r.requester_id === member.id ? r.target_id : r.requester_id)

  if (partnerIds.length === 0) {
    return NextResponse.json({ ok: true, partners: [] })
  }

  const today      = getCheckinDayTaipei()
  const monthStart = today.substring(0, 8) + '01'

  // 2. 批次查：成員資料、本月打卡、今日鼓勵（雙向）
  const [membersRes, recordsRes, encouragesRes] = await Promise.all([
    db.from('members').select(MEMBER_COLS_STATS).in('id', partnerIds),
    db.from('checkin_records').select(RECORD_COLS_STATS)
      .in('member_id', partnerIds)
      .gte('date', monthStart)
      .lte('date', today)
      .order('date'),
    db.from('encouragements')
      .select('from_id, to_id, message')
      .eq('date', today)
      .or(`and(from_id.eq.${member.id},to_id.in.(${partnerIds.join(',')})),and(to_id.eq.${member.id},from_id.in.(${partnerIds.join(',')}))`),
  ])

  const members  = (membersRes.data   ?? []) as Member[]
  const records  = (recordsRes.data   ?? []) as CheckInRecord[]
  const encours  = (encouragesRes.data ?? []) as { from_id: string; to_id: string; message: string }[]

  // 3. 索引化
  const memberById   = new Map(members.map(m => [m.id, m] as const))
  const recordsByMid: Record<string, CheckInRecord[]> = {}
  for (const r of records) (recordsByMid[r.member_id] ||= []).push(r)

  const encouragedSet = new Set(
    encours.filter(e => e.from_id === member.id).map(e => e.to_id),
  )
  const receivedMap = new Map(
    encours.filter(e => e.to_id === member.id).map(e => [e.from_id, e.message] as const),
  )

  // 4. 組成 PartnerCard 陣列
  const partners: PartnerCard[] = partnerIds.map(pid => {
    const m   = memberById.get(pid)
    const recs = recordsByMid[pid] ?? []
    const todayRec = recs.find(r => r.date === today) ?? null
    const lastRec  = recs[recs.length - 1] ?? null
    const stats    = m ? calcMonthStats(m, recs, today) : { rate: 0 }

    return {
      id:                pid,
      name:              m?.name  ?? '?',
      level:             (m?.level ?? '青銅戰士') as PartnerCard['level'],
      checkedInToday:    !!todayRec,
      tasks:             todayRec?.tasks ?? null,
      monthRate:         stats.rate,
      punchStreak:       (todayRec ?? lastRec)?.punch_streak ?? 0,
      encouragedToday:   encouragedSet.has(pid),
      receivedFromToday: receivedMap.get(pid) ?? null,
    }
  })

  return NextResponse.json({ ok: true, partners })
}
