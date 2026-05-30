'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Check, Flame, ChevronRight, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PartnerCard, Level } from '@/types'

const LEVEL_COLOR: Record<Level, string> = {
  '黃金戰士': 'bg-amber-100 text-amber-800 border-amber-200',
  '白銀戰士': 'bg-gray-100 text-gray-700 border-gray-200',
  '青銅戰士': 'bg-orange-100 text-orange-800 border-orange-200',
}

const PREVIEW_LIMIT = 3

export function PartnersWidget() {
  const [partners, setPartners] = useState<PartnerCard[] | null>(null)

  useEffect(() => {
    fetch('/api/partners')
      .then(r => r.json())
      .then(json => { if (json.ok) setPartners(json.partners) })
      .catch(() => setPartners([]))
  }, [])

  if (partners === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-amber-600" /> 夥伴動態
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">載入中…</p>
        </CardContent>
      </Card>
    )
  }

  const preview = partners.slice(0, PREVIEW_LIMIT)
  const remaining = Math.max(0, partners.length - PREVIEW_LIMIT)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-5 h-5 text-amber-600" /> 夥伴動態
        </CardTitle>
        <Link
          href="/partners"
          className="text-xs text-muted-foreground hover:text-amber-700 flex items-center gap-0.5"
        >
          查看全部 <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {partners.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              還沒有夥伴，邀請第一位一起堅持吧！
            </p>
            <Link href="/partners">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                <UserPlus className="w-4 h-4 mr-1" /> 尋找夥伴
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {preview.map(p => (
              <Link
                key={p.id}
                href="/partners"
                className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 hover:bg-amber-50/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm truncate">{p.name}</span>
                  <Badge variant="outline" className={cn('text-[10px] px-1.5', LEVEL_COLOR[p.level])}>
                    {p.level}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  {p.punchStreak > 0 && (
                    <span className="flex items-center gap-0.5 text-orange-500">
                      <Flame className="w-3.5 h-3.5" /> {p.punchStreak}
                    </span>
                  )}
                  <span className="text-muted-foreground">{p.monthRate}%</span>
                  {p.checkedInToday ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5">
                      <Check className="w-3 h-3 mr-0.5" />已打卡
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 text-gray-400">
                      未打卡
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
            {remaining > 0 && (
              <Link
                href="/partners"
                className="block text-center text-xs text-muted-foreground hover:text-amber-700 pt-1"
              >
                + 還有 {remaining} 位夥伴
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
