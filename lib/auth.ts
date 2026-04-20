// ============================================================
// 黃金八套餐 — JWT 工具（jose 函式庫）
// ============================================================

import { SignJWT, jwtVerify } from 'jose'
import { JwtPayload } from '@/types'
import { AUTH_TOKEN_MAX_AGE } from '@/lib/cookie-options'

const RAW_JWT_SECRET = process.env.JWT_SECRET
if (!RAW_JWT_SECRET || RAW_JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET 環境變數未設定或長度不足 32 字元')
}
const JWT_SECRET = new TextEncoder().encode(RAW_JWT_SECRET)
const ISSUER   = 'golden-eight'
const AUDIENCE = 'golden-eight-app'

export async function createToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ isAdmin: payload.isAdmin, tv: payload.tv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + AUTH_TOKEN_MAX_AGE)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer:   ISSUER,
      audience: AUDIENCE,
    })
    return {
      sub:     payload.sub as string,
      isAdmin: (payload.isAdmin as boolean) ?? false,
      tv:      (payload.tv as number) ?? 0,
    }
  } catch {
    return null
  }
}

/** 從 Cookie 字串中解析 token */
export function getTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/)
  return match ? match[1] : null
}
