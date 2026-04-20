'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Sunrise, Flame, CheckCircle2, Clipboard, Trophy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ProgressBar'
import { AppIcon } from '@/lib/icons'
import { TASKS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface TodayData {
  today: string
  sunrise: string
  punchDeadline: string
  punchStreak: number
  monthRate: number
  todayRecord: { submitted: boolean; totalScore?: number; submitTime?: string; tasks?: boolean[] }
  canMakeup: boolean
  yesterday: string | null
}

interface NewAchievement { code: string; name: string; badge: string }

export default function CheckInPage() {
  const [data, setData]             = useState<TodayData | null>(null)
  const [checked, setChecked]       = useState<boolean[]>(Array(8).fill(false))
  const [note, setNote]             = useState('')
  const [makeupMode, setMakeupMode] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [achQueue, setAchQueue]     = useState<NewAchievement[]>([])
  const [showAch, setShowAch]       = useState(false)

  const loadData = useCallback(async () => {
    const res  = await fetch('/api/checkin/today')
    const json = await res.json()
    if (json.ok) { setData(json); setChecked(Array(8).fill(false)) }
    else toast.error(json.msg)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function toggleTask(i: number) {
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  async function handleSubmit() {
    setLoading(true)
    const res  = await fetch('/api/checkin/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: checked, note, date: makeupMode ? data?.yesterday : undefined }),
    })
    const json = await res.json()
    setLoading(false)

    if (!json.ok) { toast.error(json.msg); return }

    toast.success(`打卡成功！${json.totalScore} 分`)
    if (json.newAchievements?.length) {
      setAchQueue(json.newAchievements)
      setShowAch(true)
    }
    loadData()
  }

  function dismissAch() {
    const next = achQueue.slice(1)
    setAchQueue(next)
    if (next.length === 0) setShowAch(false)
  }

  if (!data) return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="h-28 rounded-xl bg-white/40 animate-pulse" />
      <div className="h-96 rounded-xl bg-white/40 animate-pulse" />
    </div>
  )

  const today    = new Date(data.today + 'T00:00:00+08:00')
  const dayNames = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div className="space-y-4 max-w-lg mx-auto">

      {/* 資訊卡 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xl font-bold">
                {(today.getMonth() + 1)}/{today.getDate()}（{dayNames[today.getDay()]}）
              </div>
              <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                <Sunrise className="w-4 h-4 shrink-0" />
                日出 {data.sunrise}，建議打拳截止 {data.punchDeadline}
              </div>
            </div>
            <div className="text-right">
              {data.punchStreak > 0 && (
                <div className="flex items-center justify-end gap-1 text-2xl font-bold text-orange-500">
                  <Flame className="w-6 h-6" /> {data.punchStreak} 天
                </div>
              )}
              <div className="text-sm text-muted-foreground">本月達成率 {data.monthRate}%</div>
            </div>
          </div>
          <ProgressBar value={data.monthRate} className="mt-3" showLabel={false} />
        </CardContent>
      </Card>

      {/* 補報提示 */}
      {data.canMakeup && !makeupMode && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-yellow-800">可補報昨日！</span>
                <span className="text-sm text-yellow-700 ml-2">今日中午 12:00 前可補報 {data.yesterday}</span>
              </div>
              <Button size="sm" variant="outline" className="border-yellow-400 text-yellow-800" onClick={() => setMakeupMode(true)}>
                補報
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {makeupMode && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Clipboard className="w-4 h-4 shrink-0" />
              目前填寫的是 <strong>{data.yesterday}</strong> 的補報
            </div>
          </CardContent>
        </Card>
      )}

      {/* 已打卡提示 */}
      {data.todayRecord.submitted ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 text-center">
            <CheckCircle2 className="mx-auto w-10 h-10 text-green-500" />
            <div className="font-semibold text-green-800 mt-1">今日已打卡！得分：{data.todayRecord.totalScore} 分</div>
            {data.todayRecord.submitTime && (
              <div className="text-sm text-green-700 mt-1">
                打卡時間：{new Intl.DateTimeFormat('zh-TW', {
                  timeZone: 'Asia/Taipei',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                  hour12: false,
                }).format(new Date(data.todayRecord.submitTime))}
              </div>
            )}
            {data.todayRecord.tasks && (
              <div className="mt-3 space-y-1 text-left">
                {TASKS.map((task, i) => (
                  <div key={i} className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
                    data.todayRecord.tasks![i] ? 'bg-green-100 text-green-800' : 'bg-white/60 text-gray-400'
                  )}>
                    <CheckCircle2 className={cn('w-4 h-4 shrink-0', data.todayRecord.tasks![i] ? 'text-green-500' : 'text-gray-300')} />
                    <span className="font-medium">{task.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 八項任務 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {makeupMode ? `補報：${data.yesterday} 八項任務` : '今日八項任務'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {TASKS.map((task, i) => (
                <button
                  key={i}
                  onClick={() => toggleTask(i)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer',
                    checked[i]
                      ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  )}
                >
                  <span className="text-amber-600 shrink-0">
                    <AppIcon name={task.icon} className="w-6 h-6" />
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{task.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {i === 1 ? `今日日出 ${data.sunrise}，建議 ${data.punchDeadline} 前完成` : task.desc}
                    </div>
                  </div>
                  <CheckCircle2
                    className={cn('w-5 h-5 text-green-500 transition-opacity', checked[i] ? 'opacity-100' : 'opacity-20')}
                  />
                </button>
              ))}
              <div className="flex gap-2 mt-3">
                <Input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="備註（選填）"
                  className="text-sm"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="shrink-0 bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  {loading ? '提交中…' : makeupMode ? '提交補報' : '提交打卡'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 成就 Modal */}
      <Dialog open={showAch} onOpenChange={open => { if (!open) setAchQueue([]); setShowAch(open) }}>
        <DialogContent className="text-center max-w-xs">
          {achQueue[0] && (
            <>
              <div className="flex justify-center mt-2">
                <AppIcon name={achQueue[0].badge} className="w-16 h-16 text-yellow-500" />
              </div>
              <h3 className="font-bold text-lg mt-2 flex items-center justify-center gap-1">
                <Trophy className="w-5 h-5 text-yellow-500" /> 成就解鎖！
              </h3>
              <p className="text-base font-semibold text-yellow-600">{achQueue[0].name}</p>
              <Button onClick={dismissAch} className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white w-full">
                太棒了！
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
