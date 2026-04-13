'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Member { id: string; name: string; join_date: string; level: string; status: string }
interface ProgressRow { id: string; name: string; level: string; totalScore: number; maxScore: number; rate: number; passing: boolean; maxStreak: number; isDawnKing: boolean }
interface PenaltyRow { name: string; level: string; rate: number; penalty: number }

export default function AdminPage() {
  const [members, setMembers]   = useState<Member[]>([])
  const [progress, setProgress] = useState<ProgressRow[]>([])
  const [penalty,  setPenalty]  = useState<{ rows: PenaltyRow[]; total: number } | null>(null)
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
  const loadPenalty  = useCallback(() =>
    fetch('/api/admin/penalty').then(r => r.json()).then(j => { if (j.ok) setPenalty({ rows: j.rows, total: j.total }) }), [])

  useEffect(() => { loadMembers(); loadProgress() }, [loadMembers, loadProgress])

  async function handleAddMember() {
    if (!mName || !/^\d{3}$/.test(mPhone)) { toast.error('請填寫完整資料'); return }
    const res  = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: mName, phoneLast3: mPhone, joinDate: mDate, level: mLevel }),
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
    toast[json.ok ? 'success' : 'error'](json.ok ? json.msg : json.msg)
    if (json.ok) loadPenalty()
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold">🌟 管理員後台</h1>

      <Tabs defaultValue="progress" onValueChange={v => { if (v === 'penalty') loadPenalty() }}>
        <TabsList className="w-full">
          <TabsTrigger value="progress" className="flex-1">全員進度</TabsTrigger>
          <TabsTrigger value="penalty"  className="flex-1">罰款總結</TabsTrigger>
          <TabsTrigger value="members"  className="flex-1">會員管理</TabsTrigger>
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
                          <span className={r.passing ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                            {r.passing ? '✅ 達標' : '❌ 未達標'}
                          </span>
                        </td>
                        <td className="text-right">{r.maxStreak} 天{r.isDawnKing ? ' 👑' : ''}</td>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">本月罰款總結</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadPenalty}>刷新</Button>
                <Button size="sm" variant="destructive" onClick={handleSettlement}>執行月結</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!penalty ? (
                <p className="text-sm text-muted-foreground">請先執行月結後查看結果</p>
              ) : penalty.rows.length === 0 ? (
                <p className="text-green-600 font-semibold">🎉 本月全員達標，無罰款！</p>
              ) : (
                <>
                  <table className="w-full text-sm mb-3">
                    <thead><tr className="border-b text-muted-foreground">
                      <th className="text-left py-2">姓名</th><th className="text-left">階梯</th>
                      <th className="text-right">達成率</th><th className="text-right">罰款</th>
                    </tr></thead>
                    <tbody>
                      {penalty.rows.map((r, i) => (
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
                    罰款總計：NT$ {penalty.total}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
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
            <div className="space-y-1"><Label>手機末三碼</Label><Input value={mPhone} onChange={e => setMPhone(e.target.value)} maxLength={3} placeholder="123" /></div>
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
