import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from './auth'
import { createServerClient } from './supabase/server'
import type { Member } from '@/types'

/** CSRF 緩解：拒絕 Origin 與 Host 不符的跨站請求 */
async function checkOrigin(): Promise<NextResponse | null> {
  const headerStore = await headers()
  const origin = headerStore.get('origin')
  const host   = headerStore.get('host')
  if (origin && host && !origin.endsWith(host)) {
    return NextResponse.json({ ok: false, msg: 'Forbidden' }, { status: 403 })
  }
  return null
}

/** Route Handler 共用：從 Cookie 取得目前成員，失敗時回傳 401 Response */
export async function getCurrentMember(): Promise<
  { member: Member; db: ReturnType<typeof createServerClient> } | NextResponse
> {
  const csrfErr = await checkOrigin()
  if (csrfErr) return csrfErr

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? null
  const payload = token ? await verifyToken(token) : null

  if (!payload) {
    return NextResponse.json({ ok: false, msg: '請先登入' }, { status: 401 })
  }

  const db = createServerClient()
  // 含 token_version 比對：遞增 DB 側的 token_version 即可撤銷此前所有 JWT。
  // 前端用不到的欄位（phone_*、failed_attempts、locked_until）不回傳。
  const { data: member, error } = await db
    .from('members')
    .select('id, name, join_date, effective_start_date, level, next_level, is_admin, status, line_user_id, line_display_name, line_picture_url, created_at, token_version')
    .eq('id', payload.sub)
    .eq('status', '活躍')
    .single()

  if (error || !member) {
    return NextResponse.json({ ok: false, msg: '帳號不存在或已停用' }, { status: 401 })
  }

  const dbTv = (member as { token_version?: number }).token_version ?? 0
  if (payload.tv !== dbTv) {
    return NextResponse.json({ ok: false, msg: '登入已過期，請重新登入' }, { status: 401 })
  }

  return { member: member as Member, db }
}

/** 從 Cookie 取得 JWT payload（不查 DB） */
export async function getTokenPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? null
  return token ? await verifyToken(token) : null
}

/**
 * Admin API 專用：查 DB 確認 is_admin，避免舊 JWT 的 isAdmin 被拔除後仍有效。
 * 回傳 { member, db } 或 401/403 Response。
 */
export async function requireAdmin(): Promise<
  { member: Member; db: ReturnType<typeof createServerClient> } | NextResponse
> {
  const csrfErr = await checkOrigin()
  if (csrfErr) return csrfErr

  const payload = await getTokenPayload()
  if (!payload) {
    return NextResponse.json({ ok: false, msg: '請先登入' }, { status: 401 })
  }
  const db = createServerClient()
  const { data: member } = await db
    .from('members')
    .select('id, name, join_date, effective_start_date, level, next_level, is_admin, status, line_user_id, line_display_name, line_picture_url, created_at, token_version')
    .eq('id', payload.sub)
    .eq('status', '活躍')
    .eq('is_admin', true)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })
  }
  const dbTv = (member as { token_version?: number }).token_version ?? 0
  if (payload.tv !== dbTv) {
    return NextResponse.json({ ok: false, msg: '登入已過期，請重新登入' }, { status: 401 })
  }
  return { member: member as Member, db }
}

/** 取得台北今日日期字串 YYYY-MM-DD */
export function getTodayTaipei(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())
}

/** 取得台北現在小時（0-23）— 使用 en-US + hour12:false 避免各地區 ICU 差異 */
export function getNowHourTaipei(): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', hour: '2-digit', hour12: false,
  }).format(new Date())
  // en-US 午夜會輸出 "24"，規一化為 0
  const h = parseInt(s, 10)
  return h === 24 ? 0 : h
}

/** 取得台北昨日日期字串 */
export function getYesterdayTaipei(): string {
  // 明確減去 86400 秒，不依賴伺服器本地時區
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' })
    .format(new Date(Date.now() - 86_400_000))
}

/**
 * 取得台北「打卡邏輯日」字串 YYYY-MM-DD。
 * 日邊界為中午 12:00：台北時間 12:00 前，仍算前一日的打卡窗口。
 * 例：4/21 10:00 → "2026-04-20"；4/21 13:00 → "2026-04-21"。
 */
export function getCheckinDayTaipei(): string {
  return getNowHourTaipei() < 12 ? getYesterdayTaipei() : getTodayTaipei()
}

/** 回傳某日期字串（YYYY-MM-DD）的前一日（日曆日） */
export function getPrevDayStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) - 86_400_000
  return new Date(t).toISOString().substring(0, 10)
}

/** 回傳某日期字串（YYYY-MM-DD）加上 n 日後的日期字串 */
export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000
  return new Date(t).toISOString().substring(0, 10)
}

/**
 * 新成員的「加入日」與「起算計分日」（以伺服器當下台北時間為準）。
 * - 台北時間 < 12:00 → 起算日 = 加入日 +1
 * - 台北時間 ≥ 12:00 → 起算日 = 加入日 +2
 */
export function computeEffectiveStartDate(): { joinDate: string; effectiveStart: string } {
  const joinDate = getTodayTaipei()
  const offset   = getNowHourTaipei() < 12 ? 1 : 2
  return { joinDate, effectiveStart: addDaysStr(joinDate, offset) }
}

/** 取得當月 YYYY-MM */
export function getYearMonth(dateStr?: string): string {
  return (dateStr ?? getTodayTaipei()).substring(0, 7)
}

/** 取得指定月份最後一天的日期字串 YYYY-MM-DD（處理各月天數差異）*/
export function getMonthEnd(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${yearMonth}-${String(lastDay).padStart(2, '0')}`
}
