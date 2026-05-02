'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Info, UserMinus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { UnselectedNextLevelRow } from '@/types'

/** chose_next_level 快照啟用月份；早於此者僅供參考 */
const SNAPSHOT_AVAILABLE_FROM = '2026-05'

interface Props {
  yearMonth: string
  /** 任何成員被停用後通知父層（用於同步重整罰款表/全員進度） */
  onChange?: () => void
}

export function UnselectedNextLevelList({ yearMonth, onChange }: Props) {
  const [rows,        setRows]        = useState<UnselectedNextLevelRow[] | null>(null)
  const [notSettled,  setNotSettled]  = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [busy,        setBusy]        = useState(false)

  const load = useCallback(async (ym: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/unselected-next-level?yearMonth=${ym}`)
      const json = await res.json()
      if (!json.ok) {
        toast.error(json.msg ?? '載入失敗')
        return
      }
      setRows(json.rows)
      setNotSettled(!!json.notSettled)
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(yearMonth) }, [yearMonth, load])

  function toggleAll(checked: boolean) {
    if (!rows) return
    setSelected(checked ? new Set(rows.map(r => r.id)) : new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
  }

  async function handleSingleDeactivate(id: string, name: string) {
    if (!confirm(`確定停用 ${name}？\n\n該成員將從活躍名單移除，登入會被擋住。`)) return
    setBusy(true)
    try {
      const res  = await fetch(`/api/admin/members/${id}`, { method: 'PATCH' })
      const json = await res.json()
      if (json.ok) {
        toast.success(`已停用 ${name}`)
        setRows(prev => prev?.filter(r => r.id !== id) ?? null)
        onChange?.()
      } else {
        toast.error(json.msg ?? '停用失敗')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleBatchDeactivate() {
    const ids = [...selected]
    if (!ids.length) return
    if (!confirm(`確定批次停用 ${ids.length} 位成員？\n\n操作後無法直接撤銷，請再次確認。`)) return
    setBusy(true)
    try {
      const res  = await fetch('/api/admin/members/batch-deactivate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ memberIds: ids }),
      })
      const json = await res.json()
      if (!json.ok) {
        toast.error(json.msg ?? '批次停用失敗')
        return
      }
      const succeededSet = new Set(json.succeeded as string[])
      const failed       = json.failed as { id: string; msg: string }[]
      if (succeededSet.size > 0) toast.success(`已停用 ${succeededSet.size} 位成員`)
      for (const f of failed) {
        const r = rows?.find(x => x.id === f.id)
        toast.error(`${r?.name ?? f.id}：${f.msg}`)
      }
      setRows(prev => prev?.filter(r => !succeededSet.has(r.id)) ?? null)
      setSelected(new Set())
      onChange?.()
    } finally {
      setBusy(false)
    }
  }

  const isLegacy   = yearMonth < SNAPSHOT_AVAILABLE_FROM
  const allChecked = rows && rows.length > 0 && rows.every(r => selected.has(r.id))

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="w-4 h-4 text-orange-500" />
          未選下月階梯（{yearMonth}）
        </h3>
        {rows && rows.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || selected.size === 0}
            onClick={handleBatchDeactivate}
          >
            <UserMinus className="w-3.5 h-3.5 mr-1" />
            批次停用（{selected.size}）
          </Button>
        )}
      </div>

      {isLegacy && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>此月份月結前未啟用快照（{SNAPSHOT_AVAILABLE_FROM} 起），名單僅供參考。</span>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">載入中…</p>}

      {!loading && notSettled && (
        <p className="text-sm text-muted-foreground italic">尚未月結，無資料。</p>
      )}

      {!loading && !notSettled && rows && rows.length === 0 && (
        <p className="text-sm text-green-600">本月所有成員均已選擇下月階梯。</p>
      )}

      {!loading && !notSettled && rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left py-2 w-8">
                  <input
                    type="checkbox"
                    checked={!!allChecked}
                    onChange={e => toggleAll(e.target.checked)}
                    aria-label="全選"
                    className="cursor-pointer"
                  />
                </th>
                <th className="text-left">姓名</th>
                <th className="text-left">階梯</th>
                <th className="text-right">達成率</th>
                <th className="text-center">狀態</th>
                <th className="text-center w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={e => toggleOne(r.id, e.target.checked)}
                      aria-label={`選擇 ${r.name}`}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="font-medium">{r.name}</td>
                  <td><Badge variant="outline">{r.level}</Badge></td>
                  <td className="text-right">
                    {r.exempted
                      ? <span className="text-xs italic text-muted-foreground">新進</span>
                      : `${r.monthRate}%`}
                  </td>
                  <td className="text-center text-xs">
                    {r.exempted
                      ? <span className="text-muted-foreground">—</span>
                      : r.monthPassing
                        ? <span className="text-green-600">通過</span>
                        : <span className="text-red-500">未通過</span>}
                  </td>
                  <td className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 border-red-200"
                      disabled={busy}
                      onClick={() => handleSingleDeactivate(r.id, r.name)}
                    >
                      停用
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
