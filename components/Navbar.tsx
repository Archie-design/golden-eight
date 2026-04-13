'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/checkin',   label: '打卡' },
  { href: '/dashboard', label: '儀表板' },
  { href: '/schedule',  label: '行程' },
]

interface NavbarProps {
  userName?: string
  isAdmin?: boolean
}

export function Navbar({ userName, isAdmin }: NavbarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <nav className="sticky top-0 z-50 glass-nav">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold text-amber-600">🌟</span>
          <span className="font-semibold text-amber-900">{userName ?? '黃金八套餐'}</span>
        </div>

        <div className="flex items-center gap-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                pathname.startsWith(link.href)
                  ? 'bg-amber-100/80 text-amber-800 shadow-sm'
                  : 'text-gray-600 hover:bg-amber-50/70'
              )}
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                pathname.startsWith('/admin')
                  ? 'bg-amber-100/80 text-amber-800 shadow-sm'
                  : 'text-gray-600 hover:bg-amber-50/70'
              )}
            >
              管理
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="ml-2 rounded-md px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            登出
          </button>
        </div>
      </div>
    </nav>
  )
}
