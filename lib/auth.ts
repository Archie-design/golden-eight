// ============================================================
// 黃金八套餐 — JWT 工具（jose 函式庫）
// ============================================================

import { SignJWT, jwtVerify } from 'jose'
import { JwtPayload } from '@/types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-please-set-env'
)
const ISSUER   = 'golden-eight'
const AUDIENCE = 'golden-eight-app'
const TTL      = '30d'

export async function createToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ isAdmin: payload.isAdmin })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(TTL)
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
