import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember, getTodayTaipei, getYesterdayTaipei, getNowHourTaipei } from '@/lib/api-helper'
import { calcBaseScore, calcNewAchievements } from '@/lib/scoring'
import type { CheckInRecord } from '@/types'

export async function POST(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const { tasks, note, date: targetDate } = await request.json()
  const today     = getTodayTaipei()
  const yesterday = getYesterdayTaipei()
  const nowHour   = getNowHourTaipei()
  const target    = targetDate || today

  // 驗證日期
  if (target !== today) {
    if (target !== yesterday) return NextResponse.json({ ok: false, msg: '只能補報前一天的記錄' }, { status: 400 })
    if (nowHour >= 12)        return NextResponse.json({ ok: false, msg: '補報時間已截止（每日中午 12:00 前）' }, { status: 400 })
  }

  // 防重複提交
  const { data: existing } = await db
    .from('checkin_records').select('id').eq('member_id', member.id).eq('date', target).maybeSingle()
  if (existing) return NextResponse.json({ ok: false, msg: `${target} 的打卡記錄已存在` }, { status: 409 })

  // 任務陣列正規化（8 個布林）
  const normalizedTasks: boolean[] = Array.from({ length: 8 }, (_, i) => Boolean(tasks?.[i]))
  const baseScore  = calcBaseScore(normalizedTasks)
  const totalScore = baseScore

  // 昨日紀錄（計算連續打拳天數，供成就系統使用）
  const { data: prevRec } = await db
    .from('checkin_records').select('*').eq('member_id', member.id).eq('date', yesterday).maybeSingle()

  const punchStreak = normalizedTasks[1]
    ? ((prevRec as { punch_streak?: number } | null)?.punch_streak ?? 0) + 1
    : 0

  // 寫入打卡紀錄
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
  if (insertError) return NextResponse.json({ ok: false, msg: '打卡失敗，請稍後再試' }, { status: 500 })

  // 成就計算
  const [allRecsRes, unlockedRes] = await Promise.all([
    db.from('checkin_records').select('*').eq('member_id', member.id).order('date'),
    db.from('achievements').select('code').eq('member_id', member.id),
  ])
  const allRecs       = (allRecsRes.data ?? []) as CheckInRecord[]
  const alreadyCodes  = (unlockedRes.data ?? []).map((a: { code: string }) => a.code)

  const todayFull = allRecs.find(r => r.date === target) as CheckInRecord
  const newAchievements = calcNewAchievements(allRecs, todayFull, alreadyCodes)

  if (newAchievements.length > 0) {
    await db.from('achievements').insert(
      newAchievements.map(a => ({ member_id: member.id, code: a.code }))
    )
  }

  return NextResponse.json({ ok: true, msg: '打卡成功', totalScore, baseScore, punchStreak, newAchievements })
}
