'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sunrise, Moon, Flame, CheckCircle2, Trophy, Pencil, ImagePlus,
} from 'lucide-react'
import { compressImage } from '@/lib/image-compress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ProgressBar'
import { AppIcon, TaskIcon } from '@/lib/icons'
import { TASKS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { captureAndShare } from '@/lib/share-image'
import { MonthProgressCard, type MonthProgressCardProps } from '@/components/MonthProgressCard'

interface TodayData {
  today: string        // 打卡邏輯日
  calendarDay: string  // 實際日曆日（顯示用）
  sunrise: string
  punchStart: string
  suggestedSleep: string
  sunrisePhotoUrl: string | null
  punchStreak: number
  monthRate: number
  todayLeave: { reason: string } | null
  todayRecord: { submitted: boolean; totalScore?: number; submitTime?: string; tasks?: boolean[]; note?: string; work_hours?: number | null; early_sleep_half?: boolean; run_minutes?: number | null; run_km?: number | null }
}

interface NewAchievement { code: string; name: string; badge: string }

export default function CheckInPage() {
  const searchParams = useSearchParams()
  const [data, setData]         = useState<TodayData | null>(null)
  const [checked, setChecked]   = useState<boolean[]>(Array(8).fill(false))
  const [note, setNote]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [achQueue, setAchQueue] = useState<NewAchievement[]>([])
  const [showAch, setShowAch]   = useState(false)
  const [isEditing, setIsEditing]           = useState(false)
  const [workHours, setWorkHours]           = useState<string>('')
  const [earlySleepHalf, setEarlySleepHalf] = useState(false)
  const [expandedTask, setExpandedTask]     = useState<number | null>(null)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef        = useRef<TodayData | null>(null)
  const doneCardRef    = useRef<HTMLDivElement | null>(null)
  const [sharing, setSharing]           = useState(false)
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null)
  const sunriseInputRef = useRef<HTMLInputElement | null>(null)
  const [sunriseUploading, setSunriseUploading] = useState(false)
  const [sunrisePhotoUrl, setSunrisePhotoUrl]   = useState<string | null>(null)
  const [runMinutes, setRunMinutes] = useState('')
  const [runKm, setRunKm]           = useState('')
  const [runSaving, setRunSaving]   = useState(false)
  // 請假
  const [leaveReasons, setLeaveReasons] = useState<string[]>([])
  const [leaveReason, setLeaveReason]   = useState('')
  const [leaveSaving, setLeaveSaving]   = useState(false)
  const [leaveStart, setLeaveStart]     = useState('')   // 起訖日；空時預設今日邏輯日
  const [leaveEnd, setLeaveEnd]         = useState('')
  // 首次打卡後的本月進度彈窗（見 checkin-progress-popup 變更）
  const [showProgress, setShowProgress]     = useState(false)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressData, setProgressData]     = useState<MonthProgressCardProps | null>(null)
  const pendingProgressRef  = useRef(false)   // 成就佇列跑完後是否需接著開進度彈窗
  const progressAbortRef    = useRef<AbortController | null>(null)

  function loadData() {
    fetch('/api/checkin/today')
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setData(json)
          setChecked(Array(8).fill(false))
          setNote('')
          setWorkHours('')
          setEarlySleepHalf(false)
          setIsEditing(false)
          setSunrisePhotoUrl(json.sunrisePhotoUrl ?? null)
          setRunMinutes(json.todayRecord?.run_minutes != null ? String(json.todayRecord.run_minutes) : '')
          setRunKm(json.todayRecord?.run_km != null ? String(json.todayRecord.run_km) : '')
        } else {
          toast.error(json.msg)
        }
      })
  }

  function startEdit() {
    if (!data?.todayRecord.submitted) return
    setChecked(data.todayRecord.tasks ?? Array(8).fill(false))
    setNote(data.todayRecord.note ?? '')
    setWorkHours(data.todayRecord.work_hours != null ? String(data.todayRecord.work_hours) : '')
    setEarlySleepHalf(data.todayRecord.early_sleep_half ?? false)
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setChecked(Array(8).fill(false))
    setNote('')
    setWorkHours('')
    setEarlySleepHalf(false)
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    fetch('/api/checkin/leave-reasons').then(r => r.json()).then(j => { if (j.ok) setLeaveReasons(j.data) }).catch(() => {})
  }, [])

  // 台北中午 12:00 換日：自動重新載入
  useEffect(() => {
    const now = new Date()
    const taipeiHour = (now.getUTCHours() + 8) % 24
    if (taipeiHour >= 12) return
    const msUntilNoon = (
      (12 - taipeiHour) * 3600 -
      now.getUTCMinutes() * 60 -
      now.getUTCSeconds()
    ) * 1000 - now.getUTCMilliseconds()
    const timer = setTimeout(loadData, msUntilNoon)
    return () => clearTimeout(timer)
  }, [])

  // 回到頁面時（手機切換 App 後）偵測打卡日是否已變，若變則重新載入
  useEffect(() => {
    function getCheckinDayClient() {
      const d = new Date(Date.now() + 8 * 3600_000)
      if (d.getUTCHours() < 12) d.setUTCDate(d.getUTCDate() - 1)
      return d.toISOString().slice(0, 10)
    }
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (dataRef.current && getCheckinDayClient() !== dataRef.current.today) loadData()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // data 同步到 ref，讓 visibilitychange handler 讀到最新值
  useEffect(() => { dataRef.current = data }, [data])

  useEffect(() => {
    if (searchParams.get('from') !== 'line') return
    if (!(navigator as { standalone?: boolean }).standalone) {
      toast('提示：下次請直接從主畫面開啟 App，體驗更佳', { duration: 6000 })
    }
  }, [searchParams])

  function toggleTask(i: number) {
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  function showIconPopup(i: number) {
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
    setExpandedTask(i)
    expandTimerRef.current = setTimeout(() => setExpandedTask(null), 800)
  }

  // 首次打卡成功後載入本月進度彈窗資料（僅 POST，不含 PATCH 修改路徑）。
  // 與成就彈窗序列化：由呼叫端決定何時呼叫（無成就時立即呼叫；有成就則等 achQueue 清空後呼叫）。
  async function loadProgressPopup() {
    progressAbortRef.current?.abort()
    const ac = new AbortController()
    progressAbortRef.current = ac
    setShowProgress(true)
    setProgressLoading(true)
    setProgressData(null)
    try {
      const res  = await fetch('/api/stats/dashboard', { signal: ac.signal })
      const json = await res.json()
      if (json.ok) {
        setProgressData({
          totalScore:   json.totalScore,
          maxScore:     json.maxScore,
          rate:         json.rate,
          targetScore:  json.targetScore,
          remaining:    json.remaining,
          daysLeft:     json.daysLeft,
          dailyNeeded:  json.dailyNeeded,
          targetStatus: json.targetStatus,
          level:        json.user.level,
          calendar:     json.calendar,
          lastMonthDailyRates:     json.lastMonthDailyRates,
          historicalAvgDailyRates: json.historicalAvgDailyRates,
        })
      } else {
        toast.error(json.msg ?? '進度載入失敗，請再試一次')
        setShowProgress(false)
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      toast.error('進度載入失敗，請再試一次')
      setShowProgress(false)
    } finally {
      setProgressLoading(false)
    }
  }

  async function handleSubmit() {
    // 破曉打拳需先完成早睡早起/子時入睡：送出前先攔截（後端為主防線）
    if (checked[1] && !checked[0]) {
      toast.error('要打卡「破曉打拳」前，請先完成「早睡早起（子時入睡）」')
      return
    }
    setLoading(true)
    const method = isEditing ? 'PATCH' : 'POST'
    const res  = await fetch('/api/checkin/submit', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: checked,
        note,
        early_sleep_half: earlySleepHalf,
        ...(workHours !== '' ? { work_hours: Number(workHours) } : {}),
      }),
    })
    const json = await res.json()
    setLoading(false)

    if (!json.ok) { toast.error(json.msg); return }

    if (isEditing) {
      const removed = (json.achievementsRemoved ?? []) as NewAchievement[]
      const added   = (json.achievementsAdded ?? []) as NewAchievement[]
      toast.success(`修改成功！得分：${json.totalScore} 分`)
      if (removed.length > 0) {
        toast.warning(`已撤銷 ${removed.length} 項成就：${removed.map(r => r.name).join('、')}`, { duration: 5000 })
      }
      if (added.length > 0) {
        setAchQueue(added)
        setShowAch(true)
      }
      loadData()
      // PATCH（修改今日打卡）不觸發本月進度彈窗
      return
    }

    toast.success(`打卡成功！${json.totalScore} 分`)
    if (json.newAchievements?.length) {
      setAchQueue(json.newAchievements)
      setShowAch(true)
      pendingProgressRef.current = true   // 成就彈窗跑完後才接著開進度彈窗
    } else {
      loadProgressPopup()
    }
    loadData()
  }

  function dismissAch() {
    const next = achQueue.slice(1)
    setAchQueue(next)
    if (next.length === 0) {
      setShowAch(false)
      if (pendingProgressRef.current) {
        pendingProgressRef.current = false
        loadProgressPopup()
      }
    }
  }

  // 日出照上傳（選填，與打卡解耦：失敗只提示，不影響打卡）
  async function handleSunrisePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''   // 允許選同一張重傳
    if (!file || sunriseUploading) return
    setSunriseUploading(true)
    try {
      const blob = await compressImage(file)
      const form = new FormData()
      form.append('file', blob, 'sunrise.jpg')
      const res  = await fetch('/api/checkin/sunrise-photo', { method: 'POST', body: form })
      const json = await res.json()
      if (json.ok) {
        setSunrisePhotoUrl(json.data.url)
        toast.success('日出照已上傳，一起早起破曉！🌅')
      } else {
        toast.error(json.msg ?? '上傳失敗，請再試一次')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上傳失敗，請再試一次')
    } finally {
      setSunriseUploading(false)
    }
  }

  // 慢跑記錄送出（打卡完成後）：PATCH 帶回已提交的 tasks + 慢跑值，不改分數（純記錄）
  async function handleSaveRun() {
    const rec = (dataRef.current ?? data)?.todayRecord
    if (!rec?.submitted || runSaving) return
    // 兩欄各自獨立選填：空字串 → 該欄不帶（後端保留既有 / 視為未填）
    const m = runMinutes.trim()
    const k = runKm.trim()
    setRunSaving(true)
    try {
      const res = await fetch('/api/checkin/submit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: rec.tasks ?? Array(8).fill(false),
          note:  rec.note ?? '',
          early_sleep_half: rec.early_sleep_half ?? false,
          ...(rec.work_hours != null ? { work_hours: rec.work_hours } : {}),
          ...(m !== '' ? { run_minutes: Math.round(Number(m)) } : {}),
          ...(k !== '' ? { run_km: Number(Number(k).toFixed(2)) } : {}),
        }),
      })
      const json = await res.json()
      if (json.ok) toast.success('慢跑記錄已儲存 🏃')
      else toast.error(json.msg ?? '儲存失敗，請再試一次')
    } catch {
      toast.error('儲存失敗，請再試一次')
    } finally {
      setRunSaving(false)
    }
  }

  // 請假：起訖日區間請假（可一次多天）/ 取消請假
  async function handleRequestLeave() {
    if (!leaveReason || leaveSaving) { if (!leaveReason) toast.error('請先選擇請假事由'); return }
    const day = (dataRef.current ?? data)?.today
    if (!day) return
    const startDate = leaveStart || day       // 未填起始 → 今日
    const endDate   = leaveEnd || startDate    // 未填結束 → 當日（單日）
    if (endDate < startDate) { toast.error('結束日不能早於開始日'); return }
    setLeaveSaving(true)
    try {
      const res = await fetch('/api/checkin/leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, reason: leaveReason }),
      })
      const json = await res.json()
      if (json.ok) { toast.success(json.msg); setLeaveStart(''); setLeaveEnd(''); loadData() }
      else toast.error(json.msg)
    } catch { toast.error('請假失敗，請再試一次') }
    finally { setLeaveSaving(false) }
  }
  async function handleCancelLeave() {
    const day = (dataRef.current ?? data)?.today
    if (!day || leaveSaving) return
    setLeaveSaving(true)
    try {
      const res  = await fetch(`/api/checkin/leave?date=${day}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) { toast.success(json.msg); loadData() }
      else toast.error(json.msg)
    } catch { toast.error('取消失敗，請再試一次') }
    finally { setLeaveSaving(false) }
  }

  // 截圖分享暫停：觸發按鈕已移除，此 handler 與退化 Dialog 保留備用（加回按鈕即恢復）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleShareScreenshot() {
    const node = doneCardRef.current
    if (!node || sharing) return
    setSharing(true)
    try {
      const day = (dataRef.current ?? data)?.calendarDay ?? 'checkin'
      const result = await captureAndShare(
        node,
        `黃金八套餐-${day}.png`,
        // 排除帶 data-screenshot-exclude 的節點（按鈕列不入鏡）
        el => !(el.dataset && el.dataset.screenshotExclude === 'true'),
      )
      if (result.outcome === 'downloaded') {
        toast.success('已下載截圖，可從相簿／下載查看')
      } else if (result.outcome === 'show-image' && result.imageUrl) {
        setShareImageUrl(result.imageUrl)
      }
      // 'shared' / 'cancelled' 皆不需提示
    } catch {
      toast.error('截圖失敗，請再試一次')
    } finally {
      setSharing(false)
    }
  }

  if (!data) return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="h-28 rounded-xl bg-white/40 animate-pulse" />
      <div className="h-96 rounded-xl bg-white/40 animate-pulse" />
    </div>
  )

  const today    = new Date(data.calendarDay + 'T00:00:00+08:00')
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
                本日日出 {data.sunrise}，建議開始打拳時間為 {data.punchStart}
              </div>
              {data.suggestedSleep && (
                <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Moon className="w-4 h-4 shrink-0" />
                  想睡滿六小時，建議前一晚 {data.suggestedSleep} 前入睡
                </div>
              )}
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

      {/* 已打卡提示 */}
      {data.todayRecord.submitted && !isEditing ? (
        <Card className="border-green-200 bg-green-50" ref={doneCardRef}>
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
                    {i === 0 && data.todayRecord.tasks![0] && (
                      <span className="ml-auto text-xs opacity-70">
                        {data.todayRecord.early_sleep_half ? '0.5分' : '1分'}
                      </span>
                    )}
                    {i === 4 && data.todayRecord.work_hours != null && (
                      <span className="ml-auto text-xs opacity-70">{data.todayRecord.work_hours} 小時</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div
              data-screenshot-exclude="true"
              className="mt-3 flex items-center justify-center gap-2"
            >
              {/* 截圖分享按鈕暫停（handleShareScreenshot/share-image.ts 保留，加回本鈕即恢復）*/}
              <Button
                onClick={startEdit}
                variant="outline"
                size="sm"
                className="border-green-300 text-green-700 hover:bg-green-100"
              >
                <Pencil className="w-3.5 h-3.5 mr-1" /> 修改今日
              </Button>
            </div>

            {/* 日出照上傳（選填）：鼓勵一起早起破曉打拳 */}
            <div data-screenshot-exclude="true" className="mt-2 flex flex-col items-center gap-2">
              <input
                ref={sunriseInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSunrisePhoto}
              />
              {sunrisePhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sunrisePhotoUrl}
                  alt="今日日出"
                  className="h-24 w-24 rounded-lg border border-green-200 object-cover"
                />
              )}
              <Button
                onClick={() => sunriseInputRef.current?.click()}
                disabled={sunriseUploading}
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <ImagePlus className="w-3.5 h-3.5 mr-1" />
                {sunriseUploading ? '上傳中…' : sunrisePhotoUrl ? '換一張日出照' : '上傳今日日出照（選填）'}
              </Button>
            </div>

            {/* 丹氣慢跑記錄（選填，純記錄，不影響分數）*/}
            <div data-screenshot-exclude="true" className="mt-3 border-t border-green-200 pt-3">
              <div className="mb-2 text-center text-xs font-medium text-green-800">🏃 丹氣慢跑記錄（選填）</div>
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center gap-1">
                  <Input
                    type="number" inputMode="numeric" min={0} step={1}
                    value={runMinutes}
                    onChange={e => setRunMinutes(e.target.value)}
                    placeholder="分鐘"
                    className="h-9 w-20 text-center"
                  />
                  <span className="text-xs text-muted-foreground">分</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number" inputMode="decimal" min={0} step={0.01}
                    value={runKm}
                    onChange={e => setRunKm(e.target.value)}
                    placeholder="公里"
                    className="h-9 w-20 text-center"
                  />
                  <span className="text-xs text-muted-foreground">公里</span>
                </div>
                <Button
                  onClick={handleSaveRun}
                  disabled={runSaving}
                  variant="outline"
                  size="sm"
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  {runSaving ? '儲存中…' : '儲存'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : data.todayLeave ? (
        // 今日已請假：顯示狀態，不催打卡
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-6 text-center">
            <div className="text-3xl">🌙</div>
            <div className="mt-2 font-semibold text-blue-800">今日已請假</div>
            <div className="text-sm text-blue-700">事由：{data.todayLeave.reason}</div>
            <div className="mt-1 text-xs text-muted-foreground">此日不參與計分（分母已移除）</div>
            <Button
              onClick={handleCancelLeave}
              disabled={leaveSaving}
              variant="outline"
              size="sm"
              className="mt-3 border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              {leaveSaving ? '處理中…' : '取消請假'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 請假入口（選填；可一次請多天，請假後該區間不計分）*/}
          {!isEditing && (
            <Card className="mb-3 border-blue-100">
              <CardContent className="py-3">
                <div className="mb-2 text-sm text-muted-foreground">無法打卡？可請假（可一次請多天）</div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-xs text-muted-foreground">
                    開始日
                    <input
                      type="date"
                      value={leaveStart || data.today}
                      min={data.today}
                      onChange={e => setLeaveStart(e.target.value)}
                      className="mt-1 h-9 rounded-md border px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-muted-foreground">
                    結束日
                    <input
                      type="date"
                      value={leaveEnd || leaveStart || data.today}
                      min={leaveStart || data.today}
                      onChange={e => setLeaveEnd(e.target.value)}
                      className="mt-1 h-9 rounded-md border px-2 text-sm"
                    />
                  </label>
                  <select
                    value={leaveReason}
                    onChange={e => setLeaveReason(e.target.value)}
                    className="h-9 rounded-md border px-2 text-sm"
                    disabled={leaveReasons.length === 0}
                  >
                    <option value="">{leaveReasons.length === 0 ? '暫無可選事由' : '選擇事由'}</option>
                    {leaveReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <Button
                    onClick={handleRequestLeave}
                    disabled={leaveSaving || leaveReasons.length === 0}
                    variant="outline"
                    size="sm"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {leaveSaving ? '處理中…' : '送出請假'}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground opacity-80">單日請假：開始與結束選同一天即可。只能請今日或未來。</p>
              </CardContent>
            </Card>
          )}

          {/* 八項任務 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {isEditing ? '修改今日打卡（誤觸回溯）' : '今日八項任務'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {TASKS.map((task, i) => i === 0 ? (
                // 早睡早起：兩段式互斥按鈕（11點前 = 1分 / 12點前 = 0.5分）
                <div
                  key={i}
                  className={cn(
                    'w-full rounded-xl border p-3 transition-all',
                    checked[0]
                      ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                      : 'border-gray-100 bg-white'
                  )}
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => showIconPopup(0)}
                  >
                    <span className="shrink-0">
                      <TaskIcon image={task.image} name={task.icon} className="w-10 h-10" />
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{task.name}</div>
                      <div className="text-xs text-muted-foreground">{task.desc}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        if (checked[0] && !earlySleepHalf) {
                          setChecked(prev => prev.map((v, idx) => idx === 0 ? false : v))
                        } else {
                          setChecked(prev => prev.map((v, idx) => idx === 0 ? true : v))
                          setEarlySleepHalf(false)
                        }
                      }}
                      className={cn(
                        'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all',
                        checked[0] && !earlySleepHalf
                          ? 'border-yellow-400 bg-yellow-100 text-yellow-800'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      )}
                    >
                      11點前入睡（1分）
                    </button>
                    <button
                      onClick={() => {
                        if (checked[0] && earlySleepHalf) {
                          setChecked(prev => prev.map((v, idx) => idx === 0 ? false : v))
                          setEarlySleepHalf(false)
                        } else {
                          setChecked(prev => prev.map((v, idx) => idx === 0 ? true : v))
                          setEarlySleepHalf(true)
                        }
                      }}
                      className={cn(
                        'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all',
                        checked[0] && earlySleepHalf
                          ? 'border-yellow-400 bg-yellow-100 text-yellow-800'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      )}
                    >
                      12點前入睡（0.5分）
                    </button>
                  </div>
                </div>
              ) : i === 4 ? (
                // 工作 8 小時：數字輸入；點任務列即可標記完成（休息日填 0）
                <div
                  key={i}
                  onClick={() => {
                    // 點任務列（非輸入框）→ 切換 task 4 完成狀態
                    // 已完成 → 取消（清空工時 + 取消勾選）
                    // 未完成 → 填 0（今日不工作）+ 勾選
                    if (checked[4]) {
                      setWorkHours('')
                      setChecked(prev => prev.map((v, idx) => idx === 4 ? false : v))
                    } else {
                      setWorkHours('0')
                      setChecked(prev => prev.map((v, idx) => idx === 4 ? true : v))
                    }
                    showIconPopup(4)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer',
                    checked[i]
                      ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                      : 'border-gray-100 bg-white'
                  )}
                >
                  <span className="shrink-0">
                    <TaskIcon image={task.image} name={task.icon} className="w-10 h-10" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{task.name}</div>
                    <div className="text-xs text-muted-foreground">{task.desc}</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={workHours}
                    onChange={e => {
                      const raw = e.target.value
                      const v   = raw === '' ? '' : String(Math.max(0, Number(raw)))
                      setWorkHours(v)
                      // 有填欄位（含 0）就視為 task 4 完成；空白則取消
                      setChecked(prev => prev.map((old, idx) => idx === 4 ? v !== '' : old))
                    }}
                    onClick={e => e.stopPropagation()}
                    placeholder="0"
                    className="w-16 shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm focus:border-yellow-400 focus:outline-none"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">小時</span>
                </div>
              ) : (
                <button
                  key={i}
                  onClick={() => { toggleTask(i); showIconPopup(i) }}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer',
                    checked[i]
                      ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  )}
                >
                  <span className="shrink-0">
                    <TaskIcon image={task.image} name={task.icon} className="w-10 h-10" />
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{task.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {i === 1 ? `今日日出 ${data.sunrise}，建議 ${data.punchStart} 開始打拳` : task.desc}
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
                {isEditing && (
                  <Button
                    onClick={cancelEdit}
                    disabled={loading}
                    variant="outline"
                    className="shrink-0"
                  >
                    取消
                  </Button>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="shrink-0 bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  {loading ? (isEditing ? '修改中…' : '提交中…') : (isEditing ? '儲存修改' : '提交打卡')}
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

      {/* 本月進度彈窗（首次打卡成功後顯示） */}
      <Dialog
        open={showProgress}
        onOpenChange={open => {
          if (!open) {
            progressAbortRef.current?.abort()
            setProgressData(null)
          }
          setShowProgress(open)
        }}
      >
        <DialogContent className="max-w-lg">
          <h3 className="font-bold text-lg text-center">🎉 本月進度</h3>
          {progressLoading || !progressData ? (
            <div className="space-y-3 py-6">
              <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              <div className="h-40 rounded-lg bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <MonthProgressCard {...progressData} />
          )}
        </DialogContent>
      </Dialog>

      {expandedTask !== null && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="rounded-3xl bg-white/80 p-4 shadow-2xl backdrop-blur-sm">
            <img
              src={TASKS[expandedTask].image}
              alt={TASKS[expandedTask].name}
              className="w-52 h-52"
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>
        </div>
      )}

      {/* 截圖退化路徑：無法直接分享／下載時，顯示圖片供長按儲存 */}
      <Dialog
        open={shareImageUrl !== null}
        onOpenChange={open => {
          if (!open && shareImageUrl) {
            URL.revokeObjectURL(shareImageUrl)
            setShareImageUrl(null)
          }
        }}
      >
        <DialogContent className="max-w-xs text-center">
          <div className="text-sm font-medium text-green-800">長按圖片即可儲存到相簿</div>
          {shareImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shareImageUrl} alt="打卡截圖" className="mt-2 w-full rounded-lg border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
