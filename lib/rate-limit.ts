// ============================================================
// 輕量 rate limiter（per-instance 記憶體）— 審查報告 P1-6
// ------------------------------------------------------------
// 注意：
// 1. 以 Vercel Fluid Compute 之 instance 複用特性，同 instance 可共享狀態；
//    跨 instance 各自獨立，實際放行量 ≈ 設定值 × instance 數（可接受）。
// 2. 若未來部署至多 region / 需跨 instance 嚴格一致，可替換為 Vercel KV /
//    Upstash Ratelimit；呼叫介面保持一致即可。
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

type Bucket = { count: number; resetAt: number }
const store = new Map<string, Bucket>()

const JANITOR_INTERVAL = 60_000
let janitorStarted = false
function startJanitor() {
  if (janitorStarted) return
  janitorStarted = true
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k)
  }, JANITOR_INTERVAL).unref?.()
}

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * 檢查 rate limit；超限時回傳 429 NextResponse（含 Retry-After）。
 * @param key       分類鍵（例：`login:${ip}`）
 * @param limit     視窗內允許次數
 * @param windowMs  視窗毫秒
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  startJanitor()
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    return NextResponse.json(
      { ok: false, msg: `請求過於頻繁，請 ${retryAfter} 秒後再試` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  bucket.count += 1
  return null
}
