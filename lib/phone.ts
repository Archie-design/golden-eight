// ============================================================
// 手機號碼雜湊（HMAC-SHA256）— 審查報告 P1-8
// 目的：DB 不明碼儲存手機；登入時比對雜湊。
// ============================================================

import { createHmac } from 'crypto'

const PEPPER =
  process.env.PHONE_PEPPER
  ?? process.env.JWT_SECRET          // 未設定時退而使用 JWT_SECRET（兩者都長 32+）
  ?? ''

if (PEPPER.length < 32) {
  throw new Error('PHONE_PEPPER（或 JWT_SECRET）未設定或長度不足 32 字元')
}

export function hashPhone(phone: string): string {
  return createHmac('sha256', PEPPER).update(phone).digest('hex')
}
