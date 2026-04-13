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
  const { data: member, error } = await db
    .from('members')
    .select('*')
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
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(d)
}

/** 取得當月 YYYY-MM */
export function getYearMonth(dateStr?: string): string {
  return (dateStr ?? getTodayTaipei()).substring(0, 7)
}
