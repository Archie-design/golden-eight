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

  // 管理員頁面額外驗證
  if (pathname.startsWith('/admin') && !payload.isAdmin) {
    return NextResponse.redirect(new URL('/checkin', request.url))
  }

  return NextResponse.next()
}

export const proxyConfig = {
  matcher: ['/checkin/:path*', '/dashboard/:path*', '/schedule/:path*', '/admin/:path*'],
}
