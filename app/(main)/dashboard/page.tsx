'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarGrid } from '@/components/CalendarGrid'
import { AchievementWall } from '@/components/AchievementBadge'
import { ProgressBar } from '@/components/ProgressBar'
import { TASKS } from '@/lib/constants'

interface DashboardData {
  yearMonth: string
  user: { level: string; nextLevel?: string }
  totalScore: number
  maxScore: number
  rate: number
  targetScore: number
  remaining: number
  punchStreak: number
  maxPunchMonth: number
  calendar: { date: string; day: number; score: number | null; color: string }[]
  taskCounts: number[]
  achievements: { code: string }[]
  showNextLevelBtn: boolean
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetch('/api/stats/dashboard')
      .then(r => r.json())
      .then(json => { if (json.ok) setData(json); else toast.error(json.msg) })
  }, [])

  async function setNextLevel(level: string) {
    const res  = await fetch('/api/auth/next-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    })
    const json = await res.json()
    toast[json.ok ? 'success' : 'error'](json.msg)
    if (json.ok) setData(prev => prev ? { ...prev, user: { ...prev.user, nextLevel: level } } : prev)
  }

  if (!data) return <div className="text-center py-16 text-muted-foreground">載入中…</div>

  const maxTaskCount = Math.max(...data.taskCounts, 1)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* 本月進度 */}
      <Card>
        <CardHeader><CardTitle>📊 本月進度 <span className="text-muted-foreground text-sm font-normal">{data.yearMonth}</span></CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <div className="text-3xl font-bold text-yellow-500">{data.totalScore}</div>
              <div className="text-xs text-muted-foreground">累計得分</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{data.rate}%</div>
              <div className="text-xs text-muted-foreground">達成率</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-500">
                {data.remaining > 0 ? `-${data.remaining}` : '✅'}
              </div>
              <div className="text-xs text-muted-foreground">距目標差</div>
            </div>
          </div>

          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{data.user.level}</span>
            <span>目標 {data.targetScore} 分</span>
          </div>
          <ProgressBar value={data.rate} />

          {/* 下月階梯選擇 */}
          {data.showNextLevelBtn && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">📅 每月 25 日後可選擇下月階梯：</p>
              <div className="flex gap-2 flex-wrap">
                {['黃金戰士', '白銀戰士', '青銅戰士'].map(lv => (
                  <Button key={lv} size="sm" variant="outline" onClick={() => setNextLevel(lv)}>{lv}</Button>
                ))}
              </div>
              {data.user.nextLevel && (
                <p className="text-xs text-muted-foreground mt-2">目前已選：{data.user.nextLevel}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 月曆 */}
      <Card>
        <CardHeader><CardTitle>📅 本月打卡月曆</CardTitle></CardHeader>
        <CardContent>
          <CalendarGrid days={data.calendar} />
        </CardContent>
      </Card>

      {/* 各項任務完成次數 */}
      <Card>
        <CardHeader><CardTitle>📈 本月各項任務完成次數</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {TASKS.map((task, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-24 text-sm shrink-0">{task.icon} {task.name}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: `${Math.round((data.taskCounts[i] / maxTaskCount) * 100)}%` }}
                />
              </div>
              <div className="w-6 text-right text-sm text-muted-foreground">{data.taskCounts[i]}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 連續打拳 */}
      <Card>
        <CardHeader><CardTitle>🥊 連續打拳紀錄</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-6 text-center">
            <div className="flex-1">
              <div className="text-4xl font-bold text-yellow-500">{data.punchStreak}</div>
              <div className="text-sm text-muted-foreground">目前連續天數</div>
            </div>
            <div className="flex-1">
              <div className="text-4xl font-bold">{data.maxPunchMonth}</div>
              <div className="text-sm text-muted-foreground">本月最長連續</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 成就牆 */}
      <Card>
        <CardHeader><CardTitle>🏆 成就牆</CardTitle></CardHeader>
        <CardContent>
          <AchievementWall unlockedCodes={data.achievements.map(a => a.code)} />
        </CardContent>
      </Card>
    </div>
  )
}
