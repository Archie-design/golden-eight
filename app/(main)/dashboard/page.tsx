'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  BarChart3, Calendar, TrendingUp, Dumbbell, Trophy, LinkIcon, Unlink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarGrid } from '@/components/CalendarGrid'
import { AchievementWall } from '@/components/AchievementBadge'
import { ProgressBar } from '@/components/ProgressBar'
import { AppIcon } from '@/lib/icons'
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
  line: { bound: boolean; displayName: string | null; pictureUrl: string | null }
}

interface HistoryPoint {
  yearMonth:  string
  rate:       number | null
  totalScore: number | null
  passing:    boolean | null
  groupAvg:   number | null
}

// ── Pure-SVG rate trend chart ──────────────────────────────────────────────
function RateChart({ points }: { points: HistoryPoint[] }) {
  const W = 480, H = 120, PAD = { top: 12, right: 16, bottom: 28, left: 36 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top  - PAD.bottom

  const xPos  = (i: number) => PAD.left + (i / (points.length - 1)) * innerW
  const yPos  = (v: number) => PAD.top  + (1 - v / 100) * innerH

  const userPts   = points.map((p, i) => p.rate    !== null ? { x: xPos(i), y: yPos(p.rate),     v: p.rate }    : null)
  const groupPts  = points.map((p, i) => p.groupAvg !== null ? { x: xPos(i), y: yPos(p.groupAvg), v: p.groupAvg } : null)

  const polyline = (pts: (typeof userPts)) =>
    pts.filter(Boolean).map(p => `${p!.x},${p!.y}`).join(' ')

  const yTicks = [0, 25, 50, 75, 100]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 140 }}>
      {/* grid lines */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yPos(t)} y2={yPos(t)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={PAD.left - 4} y={yPos(t) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{t}</text>
        </g>
      ))}

      {/* group avg dashed line */}
      {groupPts.some(Boolean) && (
        <polyline points={polyline(groupPts)} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" />
      )}

      {/* user line */}
      {userPts.some(Boolean) && (
        <polyline points={polyline(userPts)} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* user dots + labels */}
      {userPts.map((p, i) => p && (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={points[i].passing ? '#f59e0b' : '#ef4444'} stroke="white" strokeWidth={1.5} />
          <text x={p.x} y={p.y - 7} fontSize={9} fill="#6b7280" textAnchor="middle">{p.v}%</text>
        </g>
      ))}

      {/* x-axis labels */}
      {points.map((p, i) => (
        <text key={i} x={xPos(i)} y={H - 6} fontSize={9} fill="#9ca3af" textAnchor="middle">
          {p.yearMonth.slice(5)}
        </text>
      ))}
    </svg>
  )
}

export default function DashboardPage() {
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const searchParams = useSearchParams()

  useEffect(() => {
    const lineResult = searchParams.get('line')
    const lineError  = searchParams.get('error')
    if (lineResult === 'bound')        toast.success('LINE 帳號綁定成功 🎉')
    if (lineError === 'line_taken')    toast.error('此 LINE 帳號已綁定其他成員')
    if (lineError === 'line_denied')   toast.error('已取消 LINE 登入')
    if (lineError === 'line_state')    toast.error('驗證失敗，請重試')
    if (lineError === 'line_token' || lineError === 'line_profile') toast.error('LINE 授權失敗，請重試')
  }, [searchParams])

  useEffect(() => {
    fetch('/api/stats/dashboard')
      .then(r => r.json())
      .then(json => { if (json.ok) setData(json); else toast.error(json.msg) })
    fetch('/api/stats/history')
      .then(r => r.json())
      .then(json => { if (json.ok) setHistory(json.history) })
  }, [])

  async function bindLine() {
    const res  = await fetch('/api/auth/line')
    const json = await res.json()
    if (json.ok) window.location.href = json.url
    else toast.error(json.msg)
  }

  async function unbindLine() {
    const res  = await fetch('/api/auth/line', { method: 'DELETE' })
    const json = await res.json()
    if (json.ok) {
      toast.success(json.msg)
      setData(prev => prev ? { ...prev, line: { bound: false, displayName: null, pictureUrl: null } } : prev)
    } else {
      toast.error(json.msg)
    }
  }

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

  if (!data) return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="h-44 rounded-xl bg-white/40 animate-pulse" />
      <div className="h-80 rounded-xl bg-white/40 animate-pulse" />
      <div className="h-48 rounded-xl bg-white/40 animate-pulse" />
    </div>
  )

  const maxTaskCount = Math.max(...data.taskCounts, 1)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* 本月進度 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> 本月進度
            <span className="text-muted-foreground text-sm font-normal">{data.yearMonth}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center mb-4">
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
                {data.remaining > 0 ? `-${data.remaining}` : '✓'}
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
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                <Calendar className="w-4 h-4 shrink-0" />
                每月 25 日後可選擇下月階梯：
              </div>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> 本月打卡月曆
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarGrid days={data.calendar} />
        </CardContent>
      </Card>

      {/* 各項任務完成次數 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> 本月各項任務完成次數
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {TASKS.map((task, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-28 flex items-center gap-1.5 text-sm shrink-0">
                <span className="text-amber-600">
                  <AppIcon name={task.icon} className="w-4 h-4" />
                </span>
                {task.name}
              </div>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" /> 連續打拳紀錄
          </CardTitle>
        </CardHeader>
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

      {/* 六個月趨勢 */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> 近六個月達成率趨勢
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RateChart points={history} />
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground justify-end">
              <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-amber-500 inline-block rounded" /> 我的達成率</span>
              <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-gray-400 inline-block rounded border-dashed border-t border-gray-400" /> 群組平均</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 成就牆 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" /> 成就牆
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AchievementWall unlockedCodes={data.achievements.map(a => a.code)} />
        </CardContent>
      </Card>

      {/* LINE 帳號綁定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#06C755]" aria-hidden="true">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            LINE 帳號
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.line.bound ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {data.line.pictureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.line.pictureUrl}
                    alt={data.line.displayName ?? 'LINE'}
                    className="w-10 h-10 rounded-full border-2 border-[#06C755]/30"
                  />
                )}
                <div>
                  <p className="text-sm font-medium">{data.line.displayName}</p>
                  <p className="text-xs text-green-600">已綁定</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={unbindLine}>
                <Unlink className="w-3.5 h-3.5 mr-1" /> 解除綁定
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">尚未綁定 LINE 帳號</p>
              <Button size="sm" className="bg-[#06C755] hover:bg-[#05a848] text-white" onClick={bindLine}>
                <LinkIcon className="w-3.5 h-3.5 mr-1" /> 綁定 LINE
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
