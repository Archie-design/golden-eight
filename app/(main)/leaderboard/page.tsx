'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Crown, Trophy, Star, Dumbbell, Medal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LeaderRow {
  rank:             number
  id:               string
  name:             string
  level:            string
  totalScore:       number
  maxScore:         number | null
  rate:             number
  passing:          boolean
  maxStreak:        number
  isDawnKing:       boolean
  achievementCount: number
  yearMonth:        string
}

const LEVEL_COLORS: Record<string, string> = {
  '黃金戰士': 'bg-amber-100 text-amber-800 border-amber-300',
  '白銀戰士': 'bg-gray-100 text-gray-700 border-gray-300',
  '青銅戰士': 'bg-orange-100 text-orange-800 border-orange-300',
}

const RANK_STYLES: Record<number, { ring: string; bg: string; icon: React.ReactNode }> = {
  1: { ring: 'ring-2 ring-amber-400',   bg: 'bg-amber-50/80',   icon: <Crown className="w-5 h-5 text-amber-500 fill-amber-300" /> },
  2: { ring: 'ring-2 ring-gray-300',    bg: 'bg-gray-50/80',    icon: <Medal className="w-5 h-5 text-gray-400" /> },
  3: { ring: 'ring-2 ring-orange-300',  bg: 'bg-orange-50/80',  icon: <Medal className="w-5 h-5 text-orange-400" /> },
}

export default function LeaderboardPage() {
  const [mode,        setMode]        = useState<'current' | 'best'>('current')
  const [rows,        setRows]        = useState<LeaderRow[]>([])
  const [yearMonth,   setYearMonth]   = useState('')
  const [fetchedMode, setFetchedMode] = useState<string | null>(null)
  const loading = fetchedMode !== mode

  useEffect(() => {
    fetch(`/api/stats/leaderboard?mode=${mode}`)
      .then(r => r.json())
      .then(json => {
        if (json.ok) { setRows(json.rows); setYearMonth(json.yearMonth) }
        else toast.error(json.msg)
      })
      .finally(() => setFetchedMode(mode))
  }, [mode])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Trophy className="w-5 h-5 text-amber-500" /> 排行榜
          {yearMonth && <span className="text-sm font-normal text-muted-foreground">{yearMonth}</span>}
        </h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === 'current' ? 'default' : 'outline'}
            className={mode === 'current' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
            onClick={() => setMode('current')}
          >
            本月
          </Button>
          <Button
            size="sm"
            variant={mode === 'best' ? 'default' : 'outline'}
            className={mode === 'best' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
            onClick={() => setMode('best')}
          >
            歷史最佳
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm text-muted-foreground">
            {mode === 'current' ? '依本月達成率排序' : '每位成員歷史最高達成率月份'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {loading && (
            <>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 rounded-xl bg-white/40 animate-pulse" />
              ))}
            </>
          )}

          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">尚無資料</p>
          )}

          {!loading && rows.map(row => {
            const rankStyle = RANK_STYLES[row.rank]
            return (
              <div
                key={row.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-white/60 bg-white/50 px-4 py-3 transition-colors',
                  rankStyle?.ring,
                  rankStyle?.bg ?? 'hover:bg-white/70',
                )}
              >
                {/* Rank */}
                <div className="w-8 flex items-center justify-center shrink-0">
                  {rankStyle ? rankStyle.icon : (
                    <span className="text-sm font-bold text-muted-foreground">{row.rank}</span>
                  )}
                </div>

                {/* Name + Level */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{row.name}</span>
                    {row.isDawnKing && (
                      <span title="破曉王">
                        <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-300 inline" />
                      </span>
                    )}
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full border',
                      LEVEL_COLORS[row.level] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                    )}>
                      {row.level}
                    </span>
                    {mode === 'best' && row.yearMonth !== '—' && (
                      <span className="text-xs text-muted-foreground">{row.yearMonth}</span>
                    )}
                  </div>

                  {/* Sub stats */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Dumbbell className="w-3 h-3" />
                      {row.maxStreak} 天
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {row.achievementCount} 成就
                    </span>
                    {row.passing && (
                      <span className="text-green-600 font-medium">✓ 通過</span>
                    )}
                  </div>
                </div>

                {/* Rate */}
                <div className="text-right shrink-0">
                  <div className={cn(
                    'text-xl font-bold',
                    row.rate >= 80 ? 'text-amber-500'
                      : row.rate >= 70 ? 'text-gray-500'
                      : row.rate >= 60 ? 'text-orange-500'
                      : 'text-red-400'
                  )}>
                    {row.rate}%
                  </div>
                  {row.maxScore != null && (
                    <div className="text-xs text-muted-foreground">
                      {row.totalScore} / {row.maxScore}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
