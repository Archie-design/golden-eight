import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCheckinDayTaipei, getPrevDayStr, getMonthEnd } from '@/lib/api-helper'
import { buildDailySnapshot, diffStatusEvents, formatDigestMessage, type DailyStatus } from '@/lib/daily-status'
import { pushTextToUsers } from '@/lib/line-push'
import { RECORD_COLS_STATS } from '@/lib/db-columns'
import type { Member, CheckInRecord } from '@/types'

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
  const monthStart = targetDate.substring(0, 7) + '-01'

  const [recsRes, prevSnapRes, currSnapRes] = await Promise.all([
    // 當月至目標日的紀錄：calcMonthStats 需要整月分母，故自月初撈起
    db.from('checkin_records').select(RECORD_COLS_STATS)
      .in('member_id', memberIds)
      .gte('date', monthStart).lte('date', getMonthEnd(targetDate.substring(0, 7)))
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

  const nameById:  Record<string, string> = {}
  const levelById: Record<string, string> = {}
  for (const m of members) {
    nameById[m.id]  = m.name
    levelById[m.id] = m.level
  }

  // 1. 建立當日快照（起算日未到者不產生列）
  const snapshot = buildDailySnapshot(members, recsByMember, prevByMember, targetDate)

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

  // 4. 變化事件（首日無前一日快照 → 空陣列，避免全員誤報）
  const events  = diffStatusEvents(prevByMember, snapshot, nameById)
  const message = formatDigestMessage(snapshot, events, nameById, levelById, targetDate)

  // 5. 推播給已綁定 LINE 的管理員
  const recipients = members
    .filter(m => m.is_admin && m.line_user_id)
    .map(m => m.line_user_id as string)

  if (!recipients.length) {
    console.warn('[cron/daily-digest] 無已綁定 LINE 的管理員，略過推播')
    return NextResponse.json({ ok: true, date: targetDate, events: events.length, pushed: 0, message })
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
    `snapshot=${snapshot.length}`, `events=${events.length}`,
    `sent=${push.sent.length}`, `failed=${push.failed.length}`,
  )

  return NextResponse.json({
    ok: true, date: targetDate,
    events: events.length,
    pushed: push.sent.length,
    failed: push.failed,
    message,
  })
}
