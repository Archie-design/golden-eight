import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from './auth'
import { createServerClient } from './supabase/server'
import type { Member } from '@/types'

/** Route Handler 共用：從 Cookie 取得目前成員，失敗時回傳 401 Response */
export async function getCurrentMember(): Promise<
  { member: Member; db: ReturnType<typeof createServerClient> } | NextResponse
> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? null
  const payload = token ? await verifyToken(token) : null

  if (!payload) {
    return NextResponse.json({ ok: false, msg: '請先登入' }, { status: 401 })
  }

  const db = createServerClient()
  // 只撈前端需要的欄位；phone_full / phone_last3 / failed_attempts / locked_until 屬 server-only
  const { data: member, error } = await db
    .from('members')
    .select('id, name, join_date, level, next_level, is_admin, status, line_user_id, line_display_name, line_picture_url, created_at')
    .eq('id', payload.sub)
    .eq('status', '活躍')
    .single()

  if (error || !member) {
    return NextResponse.json({ ok: false, msg: '帳號不存在或已停用' }, { status: 401 })
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
  const payload = await getTokenPayload()
  if (!payload) {
    return NextResponse.json({ ok: false, msg: '請先登入' }, { status: 401 })
  }
  const db = createServerClient()
  const { data: member } = await db
    .from('members')
    .select('id, name, join_date, level, next_level, is_admin, status, line_user_id, line_display_name, line_picture_url, created_at')
    .eq('id', payload.sub)
    .eq('status', '活躍')
    .eq('is_admin', true)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ ok: false, msg: '無管理員權限' }, { status: 403 })
  }
  return { member: member as Member, db }
}

/** 取得台北今日日期字串 YYYY-MM-DD */
export function getTodayTaipei(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())
}

/** 取得台北現在小時（0-23）*/
export function getNowHourTaipei(): number {
  return parseInt(
    new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: 'numeric', hour12: false }).format(new Date()),
    10
  )
}

/** 取得台北昨日日期字串 */
export function getYesterdayTaipei(): string {
  // 明確減去 86400 秒，不依賴伺服器本地時區
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' })
    .format(new Date(Date.now() - 86_400_000))
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
