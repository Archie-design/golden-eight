import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember, getCheckinDayTaipei, getPrevDayStr } from '@/lib/api-helper'
import { calcBaseScore, calcNewAchievementsFromAggregates } from '@/lib/scoring'
import { CheckInSubmitSchema, parseBody } from '@/lib/validation'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import type { CheckInRecord } from '@/types'

// 計算 streak 成就所需的最小查詢窗（最長 streak 目標為 100 天）
const STREAK_WINDOW_DAYS = 105

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  // P1-6 rate limit：每 IP 每分鐘 20 次（覆蓋失誤重試；實際打卡 1 次/日）
  const rl = checkRateLimit(`checkin:${getClientIp(request)}`, 20, 60_000)
  if (rl) return rl

  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const parsed = await parseBody(request, CheckInSubmitSchema)
  if (parsed instanceof NextResponse) return parsed
  const { tasks, note } = parsed.data

  const target  = getCheckinDayTaipei()
  const prevDay = getPrevDayStr(target)

  // 起算日驗證：打卡日早於起算日 → 拒絕（避免中午前首日打卡記到前一日、分母漏算）
  const startStr = member.effective_start_date ?? member.join_date
  if (target < startStr) {
    return NextResponse.json(
      { ok: false, msg: `計分尚未開始，起算日為 ${startStr}` },
      { status: 409 },
    )
  }

  // 防重複提交
  const { data: existing } = await db
    .from('checkin_records').select('id').eq('member_id', member.id).eq('date', target).maybeSingle()
  if (existing) return NextResponse.json({ ok: false, msg: `${target} 的打卡記錄已存在` }, { status: 409 })

  const normalizedTasks: boolean[] = Array.from({ length: 8 }, (_, i) => Boolean(tasks?.[i]))
  const baseScore  = calcBaseScore(normalizedTasks)
  const totalScore = baseScore

  const { data: prevRec } = await db
    .from('checkin_records').select('punch_streak').eq('member_id', member.id).eq('date', prevDay).maybeSingle()

  const punchStreak = normalizedTasks[1]
    ? ((prevRec as { punch_streak?: number } | null)?.punch_streak ?? 0) + 1
    : 0

  const { error: insertError } = await db.from('checkin_records').insert({
    member_id:    member.id,
    date:         target,
    tasks:        normalizedTasks,
    base_score:   baseScore,
    punch_bonus:  0,
    total_score:  totalScore,
    punch_streak: punchStreak,
    note:         note || '',
  })
  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: false, msg: `${target} 的打卡記錄已存在` }, { status: 409 })
    }
    console.error('[checkin/submit] insert failed', insertError)
    return NextResponse.json({ ok: false, msg: '打卡失敗，請稍後再試' }, { status: 500 })
  }

  // P2-15：以聚合 + 最近 N 日紀錄取代「撈全量紀錄」
  const windowStart = shiftDate(target, -(STREAK_WINDOW_DAYS - 1))
  const [totalCntRes, perfectCntRes, recentRes, unlockedRes] = await Promise.all([
    db.from('checkin_records')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', member.id),
    db.from('checkin_records')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', member.id)
      .eq('base_score', 8),
    db.from('checkin_records').select('*')
      .eq('member_id', member.id)
      .gte('date', windowStart)
      .lte('date', target)
      .order('date'),
    db.from('achievements').select('code').eq('member_id', member.id),
  ])

  const totalCount   = totalCntRes.count   ?? 0
  const perfectCount = perfectCntRes.count ?? 0
  const recent       = (recentRes.data ?? []) as CheckInRecord[]
  const todayFull    = recent.find(r => r.date === target) as CheckInRecord
  const alreadyCodes = (unlockedRes.data ?? []).map((a: { code: string }) => a.code)

  const newAchievements = calcNewAchievementsFromAggregates({
    totalCount,
    perfectCount,
    recentSorted:    recent,
    todayRecord:     todayFull,
    alreadyUnlocked: alreadyCodes,
  })

  // P3-20：插入失敗不靜默消除，而是寫 log 並回傳已處理部分
  let persistedAchievements = newAchievements
  if (newAchievements.length > 0) {
    const { error: achError } = await db.from('achievements').insert(
      newAchievements.map(a => ({ member_id: member.id, code: a.code }))
    )
    if (achError) {
      console.error('[checkin/submit] achievements insert failed', achError)
      persistedAchievements = []
    }
  }

  return NextResponse.json({
    ok: true, msg: '打卡成功', totalScore, baseScore, punchStreak,
    newAchievements: persistedAchievements,
  })
}
