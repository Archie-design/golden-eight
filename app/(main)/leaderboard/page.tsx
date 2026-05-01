'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Crown, Trophy, Star, Dumbbell, Medal, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ACHIEVEMENT_LIST } from '@/lib/constants'
import { BadgeTile } from '@/components/AchievementBadge'
import { cn } from '@/lib/utils'

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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
  exempted:         boolean
  showcaseCodes:    string[]
  settledTotal:     number | null
  settledRate:      number | null
  settledPassing:   boolean | null
  whDeduction:      number | null
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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [maxMonth,    setMaxMonth]    = useState('')
  const [showSettled, setShowSettled] = useState(false)
  const [fetchedKey,  setFetchedKey]  = useState<string | null>(null)
  const fetchKey = mode === 'current' ? `current:${selectedMonth}` : 'best'
  const loading  = fetchedKey !== fetchKey
  const isCurrentMonth = !maxMonth || selectedMonth >= maxMonth

  useEffect(() => {
    const ac = new AbortController()
    const url = mode === 'current'
      ? `/api/stats/leaderboard?mode=current&month=${selectedMonth}`
      : `/api/stats/leaderboard?mode=best`
    fetch(url, { signal: ac.signal })
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setRows(json.rows)
          setYearMonth(json.yearMonth)
          if (json.currentYearMonth) setMaxMonth(prev => prev || json.currentYearMonth)
        } else {
          toast.error(json.msg)
        }
      })
      .catch(e => { if (e.name !== 'AbortError') console.error('[leaderboard] fetch failed', e) })
      .finally(() => setFetchedKey(fetchKey))
    return () => ac.abort()
  }, [fetchKey, mode, selectedMonth])

  function navigate(delta: number) {
    setSelectedMonth(prev => {
      const next = shiftMonth(prev, delta)
      if (delta > 0 && maxMonth && next > maxMonth) return prev
      return next
    })
  }

  // toggle 扣分後時依 settledRate 重排（未月結墊底）並重編 rank
  const displayRows: LeaderRow[] = (() => {
    if (mode !== 'current' || !showSettled) return rows
    const sorted = [...rows].sort((a, b) => {
      const aSet = a.settledRate != null
      const bSet = b.settledRate != null
      if (aSet !== bSet) return aSet ? -1 : 1
      const ar = a.settledRate ?? -1
      const br = b.settledRate ?? -1
      return br - ar || a.name.localeCompare(b.name)
    })
    let rank = 1
    return sorted.map((r, i) => {
      if (i > 0 && (r.settledRate ?? -1) !== (sorted[i - 1].settledRate ?? -1)) rank = i + 1
      return { ...r, rank }
    })
  })()

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Trophy className="w-5 h-5 text-amber-500" /> 排行榜
          {mode === 'current' && (
            <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
              <button
                onClick={() => navigate(-1)}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="上個月"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="min-w-[4.5rem] text-center">{yearMonth || selectedMonth}</span>
              <button
                onClick={() => navigate(1)}
                disabled={isCurrentMonth}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="下個月"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </span>
          )}
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
        <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm text-muted-foreground">
            {mode === 'current'
              ? (isCurrentMonth ? '依本月達成率排序' : `${yearMonth} 達成率排序`)
              : '每位成員歷史最高達成率月份'}
          </CardTitle>
          {mode === 'current' && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <Switch checked={showSettled} onCheckedChange={setShowSettled} />
              扣分後
            </label>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {loading && (
            <>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 rounded-xl bg-white/40 animate-pulse" />
              ))}
            </>
          )}

          {!loading && displayRows.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">尚無資料</p>
          )}

          {!loading && displayRows.map(row => {
            const rankStyle = RANK_STYLES[row.rank]
            const useSettled  = mode === 'current' && showSettled && row.settledRate != null
            const dispRate    = useSettled ? row.settledRate! : row.rate
            const dispTotal   = useSettled ? row.settledTotal! : row.totalScore
            const dispPassing = useSettled ? row.settledPassing! : row.passing
            const notSettled  = mode === 'current' && showSettled && row.settledRate == null && !row.exempted
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

                  {/* 展示徽章 */}
                  {row.showcaseCodes.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {row.showcaseCodes.map(code => {
                        const ach = ACHIEVEMENT_LIST.find(a => a.code === code)
                        if (!ach) return null
                        return (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white/60 px-1.5 py-0.5 text-[0.7rem] font-medium text-gray-600"
                          >
                            <BadgeTile ach={ach} unlocked size="sm" />
                            {ach.name}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Sub stats */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-0.5">
                      <Dumbbell className="w-3 h-3" />
                      {row.maxStreak} 天
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {row.achievementCount} 成就
                    </span>
                    {dispPassing && (
                      <span className="text-green-600 font-medium">✓ 通過</span>
                    )}
                    {useSettled && row.whDeduction != null && row.whDeduction > 0 && (
                      <span className="text-orange-600">工時扣 -{row.whDeduction}</span>
                    )}
                  </div>
                </div>

                {/* Rate */}
                <div className="text-right shrink-0">
                  {row.exempted ? (
                    <div className="text-xs text-muted-foreground italic">不參與計分</div>
                  ) : notSettled ? (
                    <div className="text-xs text-muted-foreground italic">未月結</div>
                  ) : (
                    <>
                      <div className={cn(
                        'text-xl font-bold',
                        dispRate >= 80 ? 'text-amber-500'
                          : dispRate >= 70 ? 'text-gray-500'
                          : dispRate >= 60 ? 'text-orange-500'
                          : 'text-red-400'
                      )}>
                        {dispRate}%
                      </div>
                      {row.maxScore != null && (
                        <div className="text-xs text-muted-foreground">
                          {dispTotal} / {row.maxScore}
                        </div>
                      )}
                    </>
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
