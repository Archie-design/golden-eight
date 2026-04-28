import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember, getCheckinDayTaipei, getPrevDayStr } from '@/lib/api-helper'
import { calcBaseScore, calcNewAchievementsFromAggregates, reconcileAchievementsAfterEdit } from '@/lib/scoring'
import { CheckInSubmitSchema, parseBody } from '@/lib/validation'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { ACHIEVEMENT_LIST } from '@/lib/constants'
import { RECORD_COLS_STATS } from '@/lib/db-columns'
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
  const { tasks, note, work_hours } = parsed.data

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
  // tasks[4] 由工時決定：有填工時且 > 0 才算完成
  if (typeof work_hours === 'number') {
    normalizedTasks[4] = work_hours > 0
  }
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
    work_hours:   typeof work_hours === 'number' ? work_hours : null,
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
    db.from('checkin_records').select(RECORD_COLS_STATS)
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

// ─── PATCH：修正當日打卡（誤觸回溯） ────────────────────────────────
//
// 限制：
//   • 只能修改「當日邏輯日」記錄（getCheckinDayTaipei）
//   • 必須已有該日記錄（否則請走 POST）
// 行為：
//   • 重算 base_score / total_score / punch_streak（依昨日 streak 推進）
//   • 成就對帳：新達成者 INSERT、不再成立的 daily-class 成就 DELETE
//   • 寫 checkin_edit_logs 留下 before/after 快照
export async function PATCH(request: NextRequest) {
  const rl = checkRateLimit(`checkin-edit:${getClientIp(request)}`, 20, 60_000)
  if (rl) return rl

  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const parsed = await parseBody(request, CheckInSubmitSchema)
  if (parsed instanceof NextResponse) return parsed
  const { tasks, note, work_hours } = parsed.data

  const target  = getCheckinDayTaipei()
  const prevDay = getPrevDayStr(target)

  const startStr = member.effective_start_date ?? member.join_date
  if (target < startStr) {
    return NextResponse.json(
      { ok: false, msg: `計分尚未開始，起算日為 ${startStr}` },
      { status: 409 },
    )
  }

  // 必須有既有記錄
  const { data: existingRow } = await db
    .from('checkin_records').select(RECORD_COLS_STATS)
    .eq('member_id', member.id).eq('date', target).maybeSingle()
  const existing = existingRow as CheckInRecord | null
  if (!existing) {
    return NextResponse.json(
      { ok: false, msg: '尚未提交今日打卡，無法修改' },
      { status: 404 },
    )
  }

  const normalizedTasks: boolean[] = Array.from({ length: 8 }, (_, i) => Boolean(tasks?.[i]))
  // tasks[4] 由工時決定
  if (typeof work_hours === 'number') {
    normalizedTasks[4] = work_hours > 0
  }
  const baseScore  = calcBaseScore(normalizedTasks)
  const totalScore = baseScore

  // 昨日 streak 推進：昨日有打拳才延續，否則歸 0
  const { data: prevRecRaw } = await db
    .from('checkin_records').select('punch_streak, tasks')
    .eq('member_id', member.id).eq('date', prevDay).maybeSingle()
  const prevRec = prevRecRaw as { punch_streak?: number; tasks?: boolean[] } | null
  const prevStreak = prevRec?.tasks?.[1] ? (prevRec.punch_streak ?? 0) : 0
  const punchStreak = normalizedTasks[1] ? prevStreak + 1 : 0

  const updatedWorkHours = typeof work_hours === 'number'
    ? work_hours
    : (existing as CheckInRecord & { work_hours?: number | null }).work_hours ?? null

  const { error: updateError } = await db.from('checkin_records').update({
    tasks:        normalizedTasks,
    base_score:   baseScore,
    total_score:  totalScore,
    punch_streak: punchStreak,
    note:         note ?? existing.note ?? '',
    work_hours:   updatedWorkHours,
  }).eq('member_id', member.id).eq('date', target)

  if (updateError) {
    console.error('[checkin/edit] update failed', updateError)
    return NextResponse.json({ ok: false, msg: '修改失敗，請稍後再試' }, { status: 500 })
  }

  // 取彙總、最近 105 日、已解鎖成就
  const windowStart = shiftDate(target, -(STREAK_WINDOW_DAYS - 1))
  const [totalCntRes, perfectCntRes, recentRes, unlockedRes] = await Promise.all([
    db.from('checkin_records')
      .select('id', { count: 'exact', head: true }).eq('member_id', member.id),
    db.from('checkin_records')
      .select('id', { count: 'exact', head: true }).eq('member_id', member.id).eq('base_score', 8),
    db.from('checkin_records').select(RECORD_COLS_STATS)
      .eq('member_id', member.id).gte('date', windowStart).lte('date', target).order('date'),
    db.from('achievements').select('code').eq('member_id', member.id),
  ])

  const totalCount   = totalCntRes.count   ?? 0
  const perfectCount = perfectCntRes.count ?? 0
  const recent       = (recentRes.data ?? []) as CheckInRecord[]
  const todayFull    = recent.find(r => r.date === target)
  if (!todayFull) {
    console.error('[checkin/edit] todayFull not found after update', { target })
    return NextResponse.json({ ok: false, msg: '修改失敗，請稍後再試' }, { status: 500 })
  }
  const alreadyCodes = (unlockedRes.data ?? []).map((a: { code: string }) => a.code)

  const { add, remove } = reconcileAchievementsAfterEdit({
    totalCount,
    perfectCount,
    recentSorted:    recent,
    todayRecord:     todayFull,
    alreadyUnlocked: alreadyCodes,
  })

  if (add.length > 0) {
    const { error: addErr } = await db.from('achievements').insert(
      add.map(a => ({ member_id: member.id, code: a.code }))
    )
    if (addErr) console.error('[checkin/edit] achievements insert failed', addErr)
  }
  if (remove.length > 0) {
    const { error: rmErr } = await db.from('achievements')
      .delete().eq('member_id', member.id).in('code', remove)
    if (rmErr) console.error('[checkin/edit] achievements delete failed', rmErr)
  }

  // Audit log（失敗不阻擋主流程）
  const { error: logErr } = await db.from('checkin_edit_logs').insert({
    member_id:            member.id,
    date:                 target,
    before_tasks:         existing.tasks,
    after_tasks:          normalizedTasks,
    before_score:         existing.total_score,
    after_score:          totalScore,
    achievements_added:   add.map(a => a.code),
    achievements_removed: remove,
  })
  if (logErr) console.error('[checkin/edit] audit log failed', logErr)

  // 將撤銷的 code 對應出名稱供前端顯示
  const removedDetails = remove.map(code => {
    const ach = ACHIEVEMENT_LIST.find(a => a.code === code)
    return { code, name: ach?.name ?? code, badge: ach?.badge ?? 'Trophy' }
  })

  return NextResponse.json({
    ok: true,
    msg: '修改成功',
    totalScore,
    baseScore,
    punchStreak,
    achievementsAdded:   add,
    achievementsRemoved: removedDetails,
  })
}
