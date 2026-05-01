'use client'

import { useState } from 'react'
import { Plus, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AppIcon } from '@/lib/icons'
import { ACHIEVEMENT_LIST } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props {
  unlockedCodes: string[]
  current: string[]
  onSave: (codes: string[]) => void
}

export function ShowcaseCard({ unlockedCodes, current, onSave }: Props) {
  const [open, setOpen]       = useState(false)
  const [draft, setDraft]     = useState<string[]>(current)
  const [saving, setSaving]   = useState(false)
  const unlockedSet = new Set(unlockedCodes)

  const slots = Array.from({ length: 3 }, (_, i) => current[i] ?? null)

  function openEdit() {
    setDraft(current)
    setOpen(true)
  }

  function toggle(code: string) {
    setDraft(prev => {
      if (prev.includes(code)) return prev.filter(c => c !== code)
      if (prev.length >= 3) {
        toast('最多 3 顆，請先取消選取一顆')
        return prev
      }
      return [...prev, code]
    })
  }

  async function save() {
    setSaving(true)
    const res  = await fetch('/api/auth/me/showcase', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: draft }),
    })
    const json = await res.json()
    setSaving(false)
    if (!json.ok) { toast.error(json.msg); return }
    toast.success('已更新展示徽章')
    onSave(json.codes)
    setOpen(false)
  }

  const unlockedAchs = ACHIEVEMENT_LIST.filter(a => unlockedSet.has(a.code))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-amber-500" />
          我的展示徽章
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            顯示在排行榜
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((code, i) => {
            const ach = code ? ACHIEVEMENT_LIST.find(a => a.code === code) : null
            return (
              <button
                key={i}
                onClick={openEdit}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border p-3 transition-colors',
                  ach
                    ? 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100'
                    : 'border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100'
                )}
              >
                {ach ? (
                  <>
                    <AppIcon name={ach.badge} className="w-6 h-6 text-yellow-600" />
                    <span className="mt-1 text-[0.65rem] leading-tight text-yellow-800 line-clamp-2">{ach.name}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-gray-400" />
                    <span className="mt-1 text-[0.65rem] text-muted-foreground">未選</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">選擇展示徽章（{draft.length}/3）</DialogTitle>
          </DialogHeader>

          {unlockedAchs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              還沒有解鎖的成就，先去打卡解鎖吧！
            </p>
          ) : (
            <div className="flex-1 overflow-y-auto -mx-1 px-1">
              <div className="grid grid-cols-3 gap-2">
                {unlockedAchs.map(ach => {
                  const selected = draft.includes(ach.code)
                  return (
                    <button
                      key={ach.code}
                      onClick={() => toggle(ach.code)}
                      className={cn(
                        'relative flex flex-col items-center rounded-lg border p-2 transition-colors',
                        selected
                          ? 'border-yellow-400 bg-yellow-100 ring-2 ring-yellow-400'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      )}
                    >
                      <AppIcon name={ach.badge} className={cn('w-6 h-6', selected ? 'text-yellow-600' : 'text-gray-500')} />
                      <span className="mt-1 text-[0.6rem] leading-tight text-center line-clamp-2">{ach.name}</span>
                      {selected && (
                        <span className="absolute top-0 right-0 -translate-y-1 translate-x-1 rounded-full bg-yellow-500 text-white w-4 h-4 flex items-center justify-center text-[0.6rem]">
                          {draft.indexOf(ach.code) + 1}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setDraft([])} disabled={saving || draft.length === 0}>
              <X className="w-4 h-4 mr-1" /> 清空
            </Button>
            <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={save} disabled={saving}>
              {saving ? '儲存中…' : '儲存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
