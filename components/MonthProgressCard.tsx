'use client'

import { DailyRateChart } from '@/components/DailyRateChart'
import { LEVEL_THRESHOLDS } from '@/lib/constants'

export interface MonthProgressCardProps {
  totalScore: number
  maxScore: number
  rate: number
  targetScore: number
  remaining: number
  daysLeft: number | null
  dailyNeeded: number | null
  targetStatus: 'achieved' | 'on_track' | 'unreachable' | null
  level: string
  calendar: { day: number; score: number | null }[]
  /** 僅本月現時視圖才有值；歷史月份應傳 undefined，圖表不顯示比較線 */
  lastMonthDailyRates?: { day: number; rate: number | null }[]
  historicalAvgDailyRates?: { day: number; rate: number | null }[]
}

/**
 * 月度進度卡（不含標題列與「下月階梯選擇」——那些留在呼叫端依情境自行組裝）。
 * 同時用於 /dashboard 頁「月份進度」卡片，以及打卡頁的本月進度彈窗。
 */
export function MonthProgressCard({
  totalScore, maxScore, rate, targetScore, remaining,
  daysLeft, dailyNeeded, targetStatus, level,
  calendar, lastMonthDailyRates, historicalAvgDailyRates,
}: MonthProgressCardProps) {
  if (maxScore === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <p className="font-medium">本月新進，不參與計分</p>
        <p className="mt-1 text-xs">下個月起正式開始計分</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center mb-4">
        <div>
          <div className="text-3xl font-bold text-yellow-500">{totalScore}</div>
          <div className="text-xs text-muted-foreground">累計得分</div>
        </div>
        <div>
          <div className="text-3xl font-bold">{rate}%</div>
          <div className="text-xs text-muted-foreground">達成率</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-red-500">
            {remaining > 0 ? `-${remaining}` : '✓'}
          </div>
          <div className="text-xs text-muted-foreground">距目標差</div>
        </div>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{level}</span>
        <span>目標 {targetScore} 分</span>
      </div>
      {targetStatus === 'achieved' && (
        <div className="text-xs text-green-600 font-medium mb-2">✅ 已達標，繼續保持！</div>
      )}
      {targetStatus === 'on_track' && (
        <div className="text-xs text-amber-600 font-medium mb-2">
          還有 {daysLeft} 天，平均每天需 {dailyNeeded} 分達標 💪
        </div>
      )}
      {targetStatus === 'unreachable' && (
        <div className="text-xs text-muted-foreground mb-2">本月已難達標，下月再拼！</div>
      )}
      <DailyRateChart
        calendar={calendar}
        threshold={LEVEL_THRESHOLDS[level] ?? 0.60}
        lastMonthRates={lastMonthDailyRates}
        historicalAvgRates={historicalAvgDailyRates}
      />
    </>
  )
}
