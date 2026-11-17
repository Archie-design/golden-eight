import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCheckinDayTaipei, getPrevDayStr, getMonthEnd } from '@/lib/api-helper'
import { buildDailySnapshot, formatDigestMessage, type DailyStatus } from '@/lib/daily-status'
import { calcMonthStats, calcPaceStatus, calcHistoricalAvgDailyRate } from '@/lib/scoring'
import { fetchLeaveRecords } from '@/lib/leave'
import { pushTextToUsers } from '@/lib/line-push'
import { RECORD_COLS_STATS } from '@/lib/db-columns'
import { HISTORICAL_AVG_LOOKBACK_MONTHS } from '@/lib/constants'
import type { Member, CheckInRecord } from '@/types'

const SOLE_MEMBER_ID = 'M001'   // 群組已合併，僅剩柯啟鴻一人使用（見 personal-digest-review 變更）

// GET /api/cron/daily-digest
// Vercel Cron 於每日 04:30 UTC（=12:30 Taipei）觸發。
//
// 排程必須晚於 12:00 Taipei：打卡邏輯日以中午 12:00 為界，該時刻前成員仍可補打前一日的卡。
// 12:30 留 30 分鐘 buffer，與月結 cron 排 13:00 同一原則。
//
// ⚠️ 目標邏輯日 = getCheckinDayTaipei() 的「前一日」：
//    cron 在 12:00 之後執行，getCheckinDayTaipei() 已翻為新的邏輯日（今日），
//    而剛截止的是其前一日。若誤用當日，會把才開始 30 分鐘的邏輯日判為全員漏卡。
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? ''}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, msg: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()

  // 剛截止的邏輯日（見上方註解）
  const targetDate = getPrevDayStr(getCheckinDayTaipei())
  const prevDate   = getPrevDayStr(targetDate)
  const yearMonth  = targetDate.substring(0, 7)

  const { data: membersData } = await db
    .from('members')
    .select('id, name, level, join_date, effective_start_date, is_admin, status, line_user_id')
    .eq('status', '活躍')
    .order('id')

  const members = (membersData ?? []) as Member[]
  if (!members.length) {
    return NextResponse.json({ ok: true, date: targetDate, msg: '無活躍成員', pushed: 0 })
  }

  const memberIds = members.map(m => m.id)
  const monthStart = yearMonth + '-01'

  const [recsRes, prevSnapRes, currSnapRes] = await Promise.all([
    // 當月至目標日的紀錄：calcMonthStats 需要整月分母，故自月初撈起
    db.from('checkin_records').select(RECORD_COLS_STATS)
      .in('member_id', memberIds)
      .gte('date', monthStart).lte('date', getMonthEnd(yearMonth))
      .order('date'),
    db.from('daily_status_snapshot').select('member_id, missed, miss_streak, rate, passing')
      .eq('date', prevDate).in('member_id', memberIds),
    // 冪等：該日是否已推播過
    db.from('daily_status_snapshot').select('member_id, pushed_at')
      .eq('date', targetDate).not('pushed_at', 'is', null).limit(1),
  ])

  const recsByMember: Record<string, CheckInRecord[]> = {}
  ;((recsRes.data ?? []) as CheckInRecord[]).forEach(r => {
    (recsByMember[r.member_id] ??= []).push(r)
  })

  const prevByMember: Record<string, DailyStatus> = {}
  ;((prevSnapRes.data ?? []) as DailyStatus[]).forEach(s => {
    prevByMember[s.member_id] = s
  })

  // 1. 建立當日快照（起算日未到者不產生列）—— 快照寫入邏輯維持不變，與訊息呈現格式正交
  // 請假紀錄（含事由）：目標月一次撈，分母（snapshot）與漏卡/請假判定皆據此
  const leaveRecordsByMember = await fetchLeaveRecords(db, memberIds, yearMonth)
  const leaveByMember: Record<string, Set<string>> = {}
  const leaveReasonByMember: Record<string, string> = {}
  for (const id of memberIds) {
    const m = leaveRecordsByMember[id] ?? new Map<string, string>()
    leaveByMember[id] = new Set(m.keys())
    const reason = m.get(targetDate)
    if (reason) leaveReasonByMember[id] = reason
  }
  const snapshot = buildDailySnapshot(members, recsByMember, prevByMember, targetDate, leaveByMember)

  // 2. 先寫快照、後推播 —— 推播失敗不應使已確立的事實遺失
  const { error: upsertErr } = await db.from('daily_status_snapshot').upsert(
    snapshot.map(s => ({ ...s, date: targetDate })),
    { onConflict: 'date,member_id' },
  )
  if (upsertErr) {
    console.error('[cron/daily-digest] snapshot upsert failed', upsertErr)
    return NextResponse.json({ ok: false, msg: '快照寫入失敗' }, { status: 500 })
  }

  // 3. 已推播過則不重複推播（快照仍以 upsert 覆蓋，保持冪等）
  const alreadyPushed = ((currSnapRes.data ?? []) as { pushed_at: string | null }[]).length > 0
  if (alreadyPushed) {
    return NextResponse.json({ ok: true, date: targetDate, msg: '本日已推播，略過', pushed: 0 })
  }

  // 4. 組個人復盤內容（僅柯啟鴻一人，見 personal-digest-review 變更）
  const soleMember = members.find(m => m.id === SOLE_MEMBER_ID)
  if (!soleMember) {
    console.error('[cron/daily-digest] 柯啟鴻（M001）不是活躍成員，無法產生復盤')
    return NextResponse.json({ ok: false, date: targetDate, msg: '柯啟鴻不是活躍成員', pushed: 0 }, { status: 500 })
  }

  const soleRecords  = recsByMember[SOLE_MEMBER_ID] ?? []
  const soleLeave    = leaveByMember[SOLE_MEMBER_ID]
  const todayRecord  = soleRecords.find(r => r.date === targetDate)
  const todayLeave   = soleLeave?.has(targetDate) ?? false

  const monthStats = calcMonthStats(soleMember, soleRecords, targetDate, soleLeave)
  // refDateComplete=true：日報的基準日是「已截止日」，該日已完整結束
  const paceStatus = calcPaceStatus(soleMember, monthStats, soleRecords, targetDate, yearMonth, true, soleLeave)

  // 上月同一天：依日序對齊（例如目標日為 11/16 則取上月第 16 天）
  const [ty, tm] = yearMonth.split('-').map(Number)
  const prevMonthDate = new Date(Date.UTC(ty, tm - 2, 1))
  const prevYm = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`
  const targetDay = parseInt(targetDate.split('-')[2], 10)
  const lastMonthSameDayStr = `${prevYm}-${String(targetDay).padStart(2, '0')}`

  const { data: lastMonthRec } = await db
    .from('checkin_records').select('total_score')
    .eq('member_id', SOLE_MEMBER_ID).eq('date', lastMonthSameDayStr)
    .maybeSingle()
  const lastMonthRate = lastMonthRec
    ? Math.round(((lastMonthRec as { total_score: number }).total_score / 8) * 100)
    : null

  // 歷史累積平均（同一日序）：起算日 ~ 上月月底，上限回溯 HISTORICAL_AVG_LOOKBACK_MONTHS 個月
  const startStr = soleMember.effective_start_date ?? soleMember.join_date
  const lookbackDate = new Date(Date.UTC(ty, tm - 1 - HISTORICAL_AVG_LOOKBACK_MONTHS, 1))
  const lookbackStr  = `${lookbackDate.getUTCFullYear()}-${String(lookbackDate.getUTCMonth() + 1).padStart(2, '0')}-01`
  const historyStart = startStr > lookbackStr ? startStr : lookbackStr
  const historyEnd    = getMonthEnd(prevYm)

  let historicalAvgRate: number | null = null
  if (historyStart <= historyEnd) {
    const { data: historyRecs } = await db
      .from('checkin_records').select('date, total_score')
      .eq('member_id', SOLE_MEMBER_ID)
      .gte('date', historyStart).lte('date', historyEnd)
    const avgByDay = calcHistoricalAvgDailyRate((historyRecs ?? []) as { date: string; total_score: number }[])
    historicalAvgRate = avgByDay[targetDay - 1]?.rate ?? null
  }

  const message = formatDigestMessage(
    targetDate,
    {
      tasks: todayRecord?.tasks ?? null,
      score: todayRecord?.total_score ?? null,
      isLeave: todayLeave,
      leaveReason: leaveReasonByMember[SOLE_MEMBER_ID],
    },
    monthStats,
    todayRecord?.punch_streak ?? 0,
    paceStatus,
    lastMonthRate,
    historicalAvgRate,
  )

  // 5. 群組已合併，僅推播給柯啟鴻（M001）本人，不再對全體管理員群發
  const recipients = members
    .filter(m => m.id === SOLE_MEMBER_ID && m.line_user_id)
    .map(m => m.line_user_id as string)

  // 無綁定：代表柯啟鴻尚未綁 LINE 或帳號設定異常。回 500 讓 Vercel Cron 頁面標紅，
  // 避免「每天靜默不推、卻以為正常」——本次事件（CRON_SECRET 漏設）暴露的弱點。
  if (!recipients.length) {
    console.error('[cron/daily-digest] 柯啟鴻（M001）未綁定 LINE，無法推播（設定異常）')
    return NextResponse.json(
      { ok: false, date: targetDate, msg: '柯啟鴻未綁定 LINE，無法推播', pushed: 0 },
      { status: 500 },
    )
  }

  const push = await pushTextToUsers(recipients, message)

  // 6. 至少一位成功才標記 pushed_at（全失敗則保留未標記，供重跑補送）
  if (push.sent.length > 0) {
    const { error: markErr } = await db.from('daily_status_snapshot')
      .update({ pushed_at: new Date().toISOString() })
      .eq('date', targetDate)
    if (markErr) console.error('[cron/daily-digest] mark pushed_at failed', markErr)
  }

  console.log('[cron/daily-digest]', targetDate,
    `snapshot=${snapshot.length}`, `sent=${push.sent.length}`, `failed=${push.failed.length}`,
  )

  // 有收件人卻一個都沒推成功：推播管道故障（token 失效／未加好友／LINE API 異常）。
  // 快照已寫入、pushed_at 未標記（下次重跑會補送），此處回 500 讓失敗可見。
  if (push.sent.length === 0) {
    console.error('[cron/daily-digest] 推播全數失敗', JSON.stringify(push.failed))
    return NextResponse.json(
      { ok: false, date: targetDate, msg: '推播全數失敗', pushed: 0, failed: push.failed },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true, date: targetDate,
    pushed: push.sent.length,
    failed: push.failed,
    message,
  })
}
