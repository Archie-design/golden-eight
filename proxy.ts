import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PROTECTED = ['/checkin', '/dashboard', '/schedule', '/admin']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get('token')?.value ?? null
  const payload = token ? await verifyToken(token) : null

  if (!payload) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 管理員頁面的 is_admin 驗證移至 app/(main)/admin/layout.tsx
  // 原因：proxy 只能讀 JWT（可能是舊 token），DB 最新狀態由 server layout 查核

  return NextResponse.next()
}

export const proxyConfig = {
  matcher: ['/checkin/:path*', '/dashboard/:path*', '/schedule/:path*', '/admin/:path*'],
}
