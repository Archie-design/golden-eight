// ============================================================
// LINE Messaging API — Webhook 接收端點
// ============================================================
//
// 職責（薄）：讀 raw body → 驗簽 → 遍歷事件 → 依 source.type 分流 → 查 DB →
//             以 lib/line-commands 組回覆 → replyMessage（reply token，免費）。
// 業務判斷與文字組裝在 lib/line-commands.ts（純函式）；計分沿用 lib/scoring.ts。
//
// 驗簽 secret：Messaging channel 的 LINE_MESSAGING_CHANNEL_SECRET
//   （注意：與 LINE Login 綁定用的 LINE_CHANNEL_SECRET 是不同 channel，切勿混用）。
//
// 一律回 200（驗簽通過者），即使無對應指令——避免 LINE 平台判定失敗而重送。

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { getCheckinDayTaipei, getTodayTaipei, getYearMonth, getMonthEnd } from '@/lib/api-helper'
import { calcMonthStats, calcPenalty, isDawnKing } from '@/lib/scoring'
import { replyMessage } from '@/lib/line-push'
import {
  parseCommand,
  isPublicCommand,
  formatMyStatus,
  formatToday,
  formatLeaderboard,
  formatDawnKing,
  formatHelp,
  formatBindGuide,
  formatGroupPrivacyRedirect,
  type CommandKind,
  type LineSourceType,
} from '@/lib/line-commands'
import { MEMBER_COLS_STATS, RECORD_COLS_STATS } from '@/lib/db-columns'
import type { Member, CheckInRecord } from '@/types'

const LEADERBOARD_TOP_N = 5

interface LineSource {
  type:     LineSourceType
  userId?:  string
  groupId?: string
  roomId?:  string
}

interface LineEvent {
  type:        string
  replyToken?: string
  source?:     LineSource
  message?:    { type: string; text?: string }
}

/** 驗證 x-line-signature：Base64(HMAC-SHA256(secret, rawBody)) */
function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  // 長度不同時 timingSafeEqual 會拋錯，先擋
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

/** 依站台網址組出綁定引導連結（由 LINE_CALLBACK_URL 推站台根，fallback 相對路徑提示）。 */
function bindUrl(): string {
  const cb = process.env.LINE_CALLBACK_URL
  if (cb) {
    try {
      const u = new URL(cb)
      return `${u.origin}/dashboard`
    } catch {
      // ignore malformed URL
    }
  }
  return '請開啟系統網站並登入後於「個人資料」綁定 LINE'
}

export async function POST(req: Request) {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET
  if (!secret) {
    console.error('[line-webhook] LINE_MESSAGING_CHANNEL_SECRET 未設定')
    // 未設定 secret 無法驗簽，視為未授權
    return new NextResponse('unauthorized', { status: 401 })
  }

  const raw = await req.text()
  const signature = req.headers.get('x-line-signature')

  if (!verifySignature(raw, signature, secret)) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  let events: LineEvent[] = []
  try {
    const body = JSON.parse(raw) as { events?: LineEvent[] }
    events = body.events ?? []
  } catch {
    // 驗簽通過但 body 非法：回 200 避免重送，但不處理
    return NextResponse.json({ ok: true })
  }

  // 逐一處理（序列即可，量小；reply token 各自獨立）
  for (const ev of events) {
    try {
      await handleEvent(ev)
    } catch (e) {
      // 單一事件失敗不影響其餘、也不改變回傳（仍回 200）
      console.error('[line-webhook] handleEvent error', e instanceof Error ? e.message : String(e))
    }
  }

  return NextResponse.json({ ok: true })
}

async function handleEvent(ev: LineEvent): Promise<void> {
  if (ev.type !== 'message' || ev.message?.type !== 'text') return
  const replyToken = ev.replyToken
  const source     = ev.source
  const text       = ev.message.text
  if (!replyToken || !source || typeof text !== 'string') return

  const kind: CommandKind = parseCommand(text)
  if (kind === null) return // 非指令：靜默略過，不回覆

  const sourceType = source.type
  const isPrivate  = sourceType === 'user'

  // ── 群組/room：僅放行公開指令；個人指令回導向私訊文案 ──────────────
  if (!isPrivate && !isPublicCommand(kind)) {
    await replyMessage(replyToken, [{ type: 'text', text: formatGroupPrivacyRedirect() }])
    return
  }

  const db = createServerClient()

  // ── 公開指令：不需成員對應 ──────────────────────────────────────────
  if (kind === 'help') {
    await replyMessage(replyToken, [{ type: 'text', text: formatHelp(sourceType) }])
    return
  }
  if (kind === 'leaderboard' || kind === 'dawn_king') {
    const text = await buildPublicReply(db, kind)
    await replyMessage(replyToken, [{ type: 'text', text }])
    return
  }

  // ── 個人指令（此處保證 isPrivate；防呆再確認一次）─────────────────────
  if (!isPrivate) {
    await replyMessage(replyToken, [{ type: 'text', text: formatGroupPrivacyRedirect() }])
    return
  }
  const lineUserId = source.userId
  if (!lineUserId) return

  const { data: member } = await db
    .from('members')
    .select(MEMBER_COLS_STATS)
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  if (!member) {
    await replyMessage(replyToken, [{ type: 'text', text: formatBindGuide(bindUrl()) }])
    return
  }

  const text2 = await buildPersonalReply(db, member as Member, kind)
  await replyMessage(replyToken, [{ type: 'text', text: text2 }])
}

/** 排行榜 / 破曉王：撈活躍成員 + 當月 records，複用 scoring 相同序列。 */
async function buildPublicReply(
  db: ReturnType<typeof createServerClient>,
  kind: 'leaderboard' | 'dawn_king',
): Promise<string> {
  const today = getTodayTaipei()
  const ym    = getYearMonth(today)

  const { data: members } = await db
    .from('members').select(MEMBER_COLS_STATS).eq('status', '活躍').order('id')
  if (!members?.length) {
    return kind === 'leaderboard' ? formatLeaderboard([]) : formatDawnKing([])
  }

  const { data: recs } = await db
    .from('checkin_records').select(RECORD_COLS_STATS)
    .in('member_id', members.map((m: Member) => m.id))
    .gte('date', ym + '-01').lte('date', getMonthEnd(ym))
    .order('date')

  const recsByMember: Record<string, CheckInRecord[]> = {}
  ;(recs ?? []).forEach((r: CheckInRecord) => {
    (recsByMember[r.member_id] ??= []).push(r)
  })

  if (kind === 'leaderboard') {
    const rows = (members as Member[])
      .map(m => {
        const stats = calcMonthStats(m, recsByMember[m.id] ?? [], today)
        return { name: m.name, rate: stats.rate, exempted: stats.maxScore === 0 }
      })
      .filter(r => !r.exempted)          // 豁免者不列入排行
      .sort((a, b) => b.rate - a.rate)
      .map(r => ({ name: r.name, rate: r.rate }))
    return formatLeaderboard(rows, LEADERBOARD_TOP_N)
  }

  // dawn_king
  const candidates = (members as Member[])
    .filter(m => isDawnKing(m, recsByMember[m.id] ?? [], ym, today))
    .map(m => m.name)
  return formatDawnKing(candidates)
}

/** 我的狀態 / 今日：單一成員。 */
async function buildPersonalReply(
  db: ReturnType<typeof createServerClient>,
  member: Member,
  kind: 'my_status' | 'today',
): Promise<string> {
  if (kind === 'today') {
    const day = getCheckinDayTaipei()
    const { data: rec } = await db
      .from('checkin_records').select('tasks')
      .eq('member_id', member.id).eq('date', day)
      .maybeSingle()
    const tasks = (rec?.tasks as boolean[] | undefined) ?? null
    return formatToday(tasks)
  }

  // my_status
  const today = getTodayTaipei()
  const ym    = getYearMonth(today)
  const { data: recs } = await db
    .from('checkin_records').select(RECORD_COLS_STATS)
    .eq('member_id', member.id)
    .gte('date', ym + '-01').lte('date', getMonthEnd(ym))
    .order('date')

  const stats    = calcMonthStats(member, (recs ?? []) as CheckInRecord[], today)
  const exempted = stats.maxScore === 0
  const penalty  = calcPenalty(member.level, stats.passing)

  return formatMyStatus({
    name:      member.name,
    level:     member.level,
    rate:      stats.rate,
    passing:   stats.passing,
    penalty,
    remaining: stats.remaining,
    exempted,
  })
}
