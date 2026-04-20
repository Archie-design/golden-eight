'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Star, CheckCircle2, X, Crown, PartyPopper, Download, Trophy, Medal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Member     { id: string; name: string; join_date: string; level: string; status: string }
interface ProgressRow { id: string; name: string; level: string; totalScore: number; maxScore: number; rate: number; passing: boolean; maxStreak: number; isDawnKing: boolean }
interface PenaltyRow  { name: string; level: string; rate: number; penalty: number }
interface AchStat     { code: string; name: string; count: number; pct: number }
interface MemberStat  { id: string; name: string; count: number; total: number }

export default function AdminPage() {
  const [members,      setMembers]      = useState<Member[]>([])
  const [progress,     setProgress]     = useState<ProgressRow[]>([])
  const [penaltyData,  setPenaltyData]  = useState<{ yearMonth: string; rows: PenaltyRow[]; total: number } | null>(null)
  const [penaltyYM,    setPenaltyYM]    = useState(() => new Date().toISOString().slice(0, 7))
  const [achStats,     setAchStats]     = useState<AchStat[]>([])
  const [memberStats,  setMemberStats]  = useState<MemberStat[]>([])
  const [showAddModal, setShowAddModal] = useState(false)

  // 新增成員欄位
  const [mName,  setMName]  = useState('')
  const [mPhone, setMPhone] = useState('')
  const [mDate,  setMDate]  = useState(new Date().toISOString().slice(0, 10))
  const [mLevel, setMLevel] = useState('黃金戰士')

  const loadMembers  = useCallback(() =>
    fetch('/api/admin/members').then(r => r.json()).then(j => { if (j.ok) setMembers(j.members) }), [])
  const loadProgress = useCallback(() =>
    fetch('/api/stats/progress').then(r => r.json()).then(j => { if (j.ok) setProgress(j.rows) }), [])

  const loadPenalty = useCallback((ym: string) =>
    fetch(`/api/admin/penalty?yearMonth=${ym}`)
      .then(r => r.json())
      .then(j => { if (j.ok) setPenaltyData({ yearMonth: j.yearMonth, rows: j.rows, total: j.total }) }),
  [])

  const loadAchievements = useCallback(() =>
    fetch('/api/admin/achievements').then(r => r.json()).then(j => {
      if (j.ok) { setAchStats(j.achievementStats); setMemberStats(j.memberStats) }
    }), [])

  useEffect(() => { loadMembers(); loadProgress() }, [loadMembers, loadProgress])

  function handleExportCSV() {
    window.location.href = `/api/admin/export?yearMonth=${penaltyYM}`
  }

  async function handleAddMember() {
    if (!mName || !/^09\d{8}$/.test(mPhone)) { toast.error('請輸入 10 位數手機號碼'); return }
    const res  = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: mName, phone: mPhone, joinDate: mDate, level: mLevel }),
    })
    const json = await res.json()
    toast[json.ok ? 'success' : 'error'](json.msg)
    if (json.ok) { setShowAddModal(false); setMName(''); setMPhone(''); loadMembers() }
  }

  async function handleDisable(id: string, name: string) {
    if (!confirm(`確定停用 ${name}？`)) return
    const res  = await fetch(`/api/admin/members/${id}`, { method: 'PATCH' })
    const json = await res.json()
    toast[json.ok ? 'success' : 'error'](json.msg)
    if (json.ok) loadMembers()
  }

  async function handleSettlement() {
    if (!confirm('確定執行本月月結？此操作無法撤銷。')) return
    const res  = await fetch('/api/admin/settlement', { method: 'POST' })
    const json = await res.json()
    toast[json.ok ? 'success' : 'error'](json.msg)
    if (json.ok) loadPenalty(penaltyYM)
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Star className="w-5 h-5 text-amber-500 fill-amber-400" /> 管理員後台
      </h1>

      <Tabs defaultValue="progress" onValueChange={v => {
        if (v === 'penalty')      loadPenalty(penaltyYM)
        if (v === 'achievements') loadAchievements()
      }}>
        <TabsList className="w-full">
          <TabsTrigger value="progress"     className="flex-1">全員進度</TabsTrigger>
          <TabsTrigger value="penalty"      className="flex-1">罰款總結</TabsTrigger>
          <TabsTrigger value="achievements" className="flex-1">成就統計</TabsTrigger>
          <TabsTrigger value="members"      className="flex-1">會員管理</TabsTrigger>
        </TabsList>

        {/* 全員進度 */}
        <TabsContent value="progress">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">本月全員進度</CardTitle>
              <Button size="sm" variant="outline" onClick={loadProgress}>重新整理</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-muted-foreground">
                    <th className="text-left py-2">姓名</th><th className="text-left">階梯</th>
                    <th className="text-right">總分</th><th className="text-right">達成率</th>
                    <th className="text-center">狀態</th><th className="text-right">連打</th>
                  </tr></thead>
                  <tbody>
                    {progress.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{r.name}</td>
                        <td><Badge variant="outline">{r.level}</Badge></td>
                        <td className="text-right">{r.totalScore}/{r.maxScore}</td>
                        <td className="text-right">{r.rate}%</td>
                        <td className="text-center">
                          <span className={`inline-flex items-center gap-1 font-semibold ${r.passing ? 'text-green-600' : 'text-red-500'}`}>
                            {r.passing ? <><CheckCircle2 className="w-4 h-4" /> 達標</> : <><X className="w-4 h-4" /> 未達標</>}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            {r.maxStreak} 天{r.isDawnKing && <Crown className="w-4 h-4 text-yellow-500" />}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 罰款總結 */}
        <TabsContent value="penalty">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">罰款總結</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="month"
                  value={penaltyYM}
                  onChange={e => { if (e.target.value) { setPenaltyYM(e.target.value); loadPenalty(e.target.value) } }}
                  className="h-8 w-36 text-sm"
                />
                <Button size="sm" variant="outline" className="flex items-center gap-1" onClick={handleExportCSV}>
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
                <Button size="sm" variant="destructive" onClick={handleSettlement}>執行月結</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!penaltyData ? (
                <p className="text-sm text-muted-foreground">選擇月份查看，或先執行月結</p>
              ) : penaltyData.rows.length === 0 ? (
                <p className="flex items-center gap-1.5 text-green-600 font-semibold">
                  <PartyPopper className="w-4 h-4" /> {penaltyData.yearMonth} 全員達標，無罰款！
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">{penaltyData.yearMonth}</p>
                  <table className="w-full text-sm mb-3">
                    <thead><tr className="border-b text-muted-foreground">
                      <th className="text-left py-2">姓名</th><th className="text-left">階梯</th>
                      <th className="text-right">達成率</th><th className="text-right">罰款</th>
                    </tr></thead>
                    <tbody>
                      {penaltyData.rows.map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2">{r.name}</td>
                          <td>{r.level}</td>
                          <td className="text-right text-red-500">{r.rate}%</td>
                          <td className="text-right font-bold text-red-600">NT$ {r.penalty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm font-semibold">
                    罰款總計：NT$ {penaltyData.total}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 成就統計 */}
        <TabsContent value="achievements">
          <div className="space-y-4">
            {/* 補登按鈕 */}
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">補登歷史成就</p>
                <p className="text-xs text-muted-foreground">對所有既有打卡紀錄重新計算成就，補齊系統上線前遺漏的徽章</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={async () => {
                  const res  = await fetch('/api/admin/backfill-achievements', { method: 'POST' })
                  const json = await res.json()
                  if (json.ok) {
                    toast.success(`補登完成，共新增 ${json.inserted} 筆成就`)
                    loadAchievements()
                  } else {
                    toast.error(json.msg)
                  }
                }}
              >
                執行補登
              </Button>
            </div>

            {/* 成員解鎖排行 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" /> 成員解鎖數排行
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {memberStats.map((m, i) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="w-5 text-xs text-muted-foreground text-right">{i + 1}</span>
                      <span className="w-20 text-sm font-medium truncate">{m.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width: `${Math.round((m.count / m.total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {m.count} / {m.total}
                      </span>
                    </div>
                  ))}
                  {memberStats.length === 0 && (
                    <p className="text-sm text-muted-foreground">尚無成就資料</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 全部成就解鎖狀況 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Medal className="w-4 h-4 text-purple-500" /> 全部成就（共 {achStats.length} 項，依解鎖率排序）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {achStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">載入中…</p>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {achStats.map(a => (
                      <div key={a.code} className="flex items-center gap-3">
                        <div className="w-28 min-w-0 shrink-0">
                          <div className="text-sm font-medium leading-tight truncate">{a.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{a.code}</div>
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${a.pct}%`,
                              background: a.pct >= 80 ? '#22c55e' : a.pct >= 50 ? '#f59e0b' : a.pct > 0 ? '#a855f7' : '#e5e7eb',
                            }}
                          />
                        </div>
                        <div className="w-16 text-right text-xs tabular-nums shrink-0">
                          <span className={a.count > 0 ? 'font-semibold text-gray-700' : 'text-gray-400'}>
                            {a.count} 人
                          </span>
                          <span className="text-muted-foreground ml-1">({a.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 會員管理 */}
        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">會員管理</CardTitle>
              <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => setShowAddModal(true)}>
                + 新增成員
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-muted-foreground">
                    <th className="text-left py-2">ID</th><th className="text-left">姓名</th>
                    <th className="text-left">加入日</th><th className="text-left">階梯</th>
                    <th className="text-center">狀態</th><th className="text-center">操作</th>
                  </tr></thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground text-xs">{m.id}</td>
                        <td className="font-medium">{m.name}</td>
                        <td className="text-xs">{m.join_date}</td>
                        <td><Badge variant="outline">{m.level}</Badge></td>
                        <td className="text-center">
                          <Badge variant={m.status === '活躍' ? 'default' : 'secondary'}>{m.status}</Badge>
                        </td>
                        <td className="text-center">
                          {m.status === '活躍' && (
                            <Button size="sm" variant="outline" className="text-red-500 border-red-200" onClick={() => handleDisable(m.id, m.name)}>
                              停用
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 新增成員 Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>新增成員</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>姓名</Label><Input value={mName} onChange={e => setMName(e.target.value)} placeholder="姓名" /></div>
            <div className="space-y-1"><Label>手機號碼</Label><Input value={mPhone} onChange={e => setMPhone(e.target.value.replace(/\D/g, ''))} maxLength={10} inputMode="numeric" placeholder="09xxxxxxxx" /></div>
            <div className="space-y-1"><Label>加入日期</Label><Input type="date" value={mDate} onChange={e => setMDate(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>階梯</Label>
              <Select value={mLevel} onValueChange={v => v && setMLevel(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="青銅戰士">青銅戰士</SelectItem>
                  <SelectItem value="白銀戰士">白銀戰士</SelectItem>
                  <SelectItem value="黃金戰士">黃金戰士</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={handleAddMember}>新增</Button>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
