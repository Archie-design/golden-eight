'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Users, UserPlus, UserMinus, Search, Check, X, Flame, Mail } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ProgressBar'
import { TASKS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { PartnerCard, Level } from '@/types'

interface SearchResult { id: string; name: string; level: Level }
interface InvitationItem {
  id:          number
  requestedAt: string
  other:       { id: string; name: string; level: Level }
}

const LEVEL_COLOR: Record<Level, string> = {
  '黃金戰士': 'bg-amber-100 text-amber-800 border-amber-200',
  '白銀戰士': 'bg-gray-100 text-gray-700 border-gray-200',
  '青銅戰士': 'bg-orange-100 text-orange-800 border-orange-200',
}

export default function PartnersPage() {
  const [tab, setTab] = useState<'mine' | 'invites' | 'search'>('mine')

  const [partners, setPartners] = useState<PartnerCard[]>([])
  const [loadingMine, setLoadingMine] = useState(false)

  const [sent, setSent]         = useState<InvitationItem[]>([])
  const [received, setReceived] = useState<InvitationItem[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)

  const [q, setQ]               = useState('')
  const [results, setResults]   = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const [busy, setBusy] = useState(false)

  const loadPartners = useCallback(async () => {
    setLoadingMine(true)
    try {
      const r = await fetch('/api/partners').then(r => r.json())
      if (r.ok) setPartners(r.partners)
      else toast.error(r.msg ?? '載入失敗')
    } finally { setLoadingMine(false) }
  }, [])

  const loadInvites = useCallback(async () => {
    setLoadingInvites(true)
    try {
      const r = await fetch('/api/partners/invitations').then(r => r.json())
      if (r.ok) { setSent(r.sent); setReceived(r.received) }
      else toast.error(r.msg ?? '載入失敗')
    } finally { setLoadingInvites(false) }
  }, [])

  useEffect(() => {
    if (tab === 'mine')    loadPartners()
    if (tab === 'invites') loadInvites()
  }, [tab, loadPartners, loadInvites])

  // 搜尋 debounce
  useEffect(() => {
    if (tab !== 'search') return
    const trimmed = q.trim()
    if (trimmed === '') { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/partners/search?q=' + encodeURIComponent(trimmed)).then(r => r.json())
        if (r.ok) setResults(r.results)
      } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, tab])

  async function invite(id: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/partners/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: id }),
      }).then(r => r.json())
      if (r.ok) {
        toast.success(r.msg)
        setResults(prev => prev.filter(x => x.id !== id))
      } else {
        toast.error(r.msg)
      }
    } finally { setBusy(false) }
  }

  async function respondInvite(id: number, action: 'accept' | 'reject') {
    setBusy(true)
    try {
      const r = await fetch(`/api/partners/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(r => r.json())
      if (r.ok) {
        toast.success(r.msg)
        loadInvites()
        if (action === 'accept') setPartners([])
      } else {
        toast.error(r.msg)
      }
    } finally { setBusy(false) }
  }

  async function cancelInvite(id: number) {
    setBusy(true)
    try {
      const r = await fetch(`/api/partners/invitations/${id}`, { method: 'DELETE' }).then(r => r.json())
      if (r.ok) { toast.success(r.msg); loadInvites() }
      else { toast.error(r.msg) }
    } finally { setBusy(false) }
  }

  async function unbond(id: string, name: string) {
    if (!confirm(`確定解除與 ${name} 的夥伴關係？\n\n歷史鼓勵紀錄會保留，但雙方清單會移除對方。`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/partners/${id}`, { method: 'DELETE' }).then(r => r.json())
      if (r.ok) {
        toast.success(r.msg)
        setPartners(prev => prev.filter(p => p.id !== id))
      } else {
        toast.error(r.msg)
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Users className="w-5 h-5 text-amber-600" /> 夥伴
      </h1>

      <Tabs value={tab} onValueChange={(v: string) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="mine"    className="flex-1">我的夥伴</TabsTrigger>
          <TabsTrigger value="invites" className="flex-1">
            邀請管理
            {received.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700">
                {received.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="search"  className="flex-1">尋找夥伴</TabsTrigger>
        </TabsList>

        {/* === 我的夥伴 === */}
        <TabsContent value="mine" className="space-y-3 mt-3">
          {loadingMine && <p className="text-sm text-muted-foreground">載入中…</p>}
          {!loadingMine && partners.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="mx-auto w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">還沒有夥伴。到「尋找夥伴」邀請第一位吧！</p>
              </CardContent>
            </Card>
          )}
          {partners.map(p => (
            <Card key={p.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">{p.name}</span>
                    <Badge variant="outline" className={cn('text-xs', LEVEL_COLOR[p.level])}>
                      {p.level}
                    </Badge>
                    {p.checkedInToday ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                        <Check className="w-3 h-3 mr-0.5" />今日已打卡
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-gray-400">
                        今日未打卡
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:bg-red-50 shrink-0"
                    disabled={busy}
                    onClick={() => unbond(p.id, p.name)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </div>

                {/* 8 task 小圈 */}
                <div className="flex gap-1.5 flex-wrap">
                  {TASKS.map((t, i) => {
                    const done = p.tasks?.[i] ?? false
                    return (
                      <div
                        key={i}
                        title={t.name}
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium border',
                          !p.tasks
                            ? 'bg-gray-50 text-gray-300 border-gray-100'
                            : done
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-gray-100 text-gray-400 border-gray-200',
                        )}
                      >
                        {i + 1}
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground mb-0.5">本月達成率</div>
                    <div className="font-semibold">{p.monthRate}%</div>
                    <ProgressBar value={p.monthRate} className="mt-1" showLabel={false} />
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">破曉連續</div>
                    <div className="font-semibold flex items-center gap-1">
                      {p.punchStreak > 0 && <Flame className="w-3.5 h-3.5 text-orange-500" />}
                      {p.punchStreak} 天
                    </div>
                  </div>
                </div>

                {p.receivedFromToday && (
                  <div className="rounded-md bg-pink-50 border border-pink-200 px-3 py-2 text-xs text-pink-700">
                    <span className="font-medium">收到鼓勵：</span>{p.receivedFromToday}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* === 邀請管理 === */}
        <TabsContent value="invites" className="space-y-4 mt-3">
          {loadingInvites && <p className="text-sm text-muted-foreground">載入中…</p>}

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <Mail className="w-4 h-4" /> 收到的邀請（{received.length}）
            </h3>
            {received.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">目前沒有待回應的邀請</p>
            ) : (
              <div className="space-y-2">
                {received.map(inv => (
                  <Card key={inv.id}>
                    <CardContent className="py-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{inv.other.name}</span>
                        <Badge variant="outline" className={cn('text-xs', LEVEL_COLOR[inv.other.level])}>
                          {inv.other.level}
                        </Badge>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          disabled={busy}
                          onClick={() => respondInvite(inv.id, 'accept')}
                        >
                          <Check className="w-4 h-4 mr-1" />接受
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => respondInvite(inv.id, 'reject')}
                        >
                          <X className="w-4 h-4 mr-1" />拒絕
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <UserPlus className="w-4 h-4" /> 我送出的邀請（{sent.length}）
            </h3>
            {sent.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">沒有送出未回應的邀請</p>
            ) : (
              <div className="space-y-2">
                {sent.map(inv => (
                  <Card key={inv.id}>
                    <CardContent className="py-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{inv.other.name}</span>
                        <Badge variant="outline" className={cn('text-xs', LEVEL_COLOR[inv.other.level])}>
                          {inv.other.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">等待回應</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-500"
                        disabled={busy}
                        onClick={() => cancelInvite(inv.id)}
                      >
                        取消
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* === 尋找夥伴 === */}
        <TabsContent value="search" className="space-y-3 mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="輸入姓名搜尋…"
              className="pl-9"
            />
          </div>
          {searching && <p className="text-xs text-muted-foreground">搜尋中…</p>}
          {!searching && q.trim() !== '' && results.length === 0 && (
            <p className="text-sm text-muted-foreground italic">找不到符合的成員</p>
          )}
          {results.map(r => (
            <Card key={r.id}>
              <CardContent className="py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{r.name}</span>
                  <Badge variant="outline" className={cn('text-xs', LEVEL_COLOR[r.level])}>
                    {r.level}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  disabled={busy}
                  onClick={() => invite(r.id)}
                >
                  <UserPlus className="w-4 h-4 mr-1" />邀請
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
