'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Calendar, Unlock, Lock, Search, Pencil, AlertTriangle, Users, Star,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface Tag { id: string; tag_name: string; color: string; emoji?: string; is_system: boolean }
interface BlockTag { id?: string; name: string; color: string; emoji?: string }
interface Block { id?: number; startTime: string; endTime: string; tags: BlockTag[] }
interface PublicSchedule {
  memberName: string
  blocks: { startTime: string; endTime: string; tags: BlockTag[] }[]
}

const COLORS = ['#4A90D9','#E17055','#00B894','#FDCB6E','#6C5CE7','#A29BFE','#FD79A8','#55EFC4']

function isCrossMidnight(start: string, end: string) {
  return end < start
}

function tagLabel(t: BlockTag) {
  return (t.emoji ? t.emoji + ' ' : '') + t.name
}

const EMPTY_DIALOG = { open: false, editIdx: -1, startTime: '', endTime: '', selectedTags: [] as BlockTag[] }

export default function SchedulePage() {
  const [tags,       setTags]      = useState<Tag[]>([])
  const [blocks,     setBlocks]    = useState<Block[]>([])
  const [isPublic,   setIsPublic]  = useState(false)
  const [search,     setSearch]    = useState('')
  const [showTag,    setShowTag]   = useState(false)
  const [showGroup,  setShowGroup] = useState(false)
  const [groupData,  setGroupData] = useState<PublicSchedule[]>([])
  const [tagName,    setTagName]   = useState('')
  const [tagColor,   setTagColor]  = useState(COLORS[0])
  const [tagEmoji,   setTagEmoji]  = useState('')
  const [dialog,     setDialog]    = useState(EMPTY_DIALOG)

  const loadData = useCallback(async () => {
    const res  = await fetch('/api/schedule/data')
    const json = await res.json()
    if (json.ok) { setTags(json.tags); setBlocks(json.blocks ?? []); setIsPublic(json.isPublic) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── 儲存模板 ──────────────────────────────────────────────
  async function saveTemplate() {
    const res  = await fetch('/api/schedule/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks, isPublic }),
    })
    const json = await res.json()
    toast[json.ok ? 'success' : 'error'](json.msg)
  }

  // ─── 標籤管理 ──────────────────────────────────────────────
  async function addTag() {
    if (!tagName) { toast.error('請填寫標籤名稱'); return }
    const res  = await fetch('/api/schedule/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagName, color: tagColor, emoji: tagEmoji }),
    })
    const json = await res.json()
    if (json.ok) { setTags(prev => [...prev, json.tag]); setShowTag(false); setTagName(''); setTagEmoji('') }
    else toast.error(json.msg)
  }

  async function deleteTag(tag: Tag) {
    if (tag.is_system) { toast.error('系統標籤無法刪除'); return }
    const res  = await fetch('/api/schedule/tag', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: tag.id }),
    })
    const json = await res.json()
    if (json.ok) setTags(prev => prev.filter(t => t.id !== tag.id))
    else toast.error(json.msg)
  }

  async function loadGroup() {
    const res  = await fetch('/api/schedule/public')
    const json = await res.json()
    if (json.ok) setGroupData(json.schedules)
    setShowGroup(true)
  }

  // ─── 對話框：新增 / 編輯 ───────────────────────────────────
  function openAdd() {
    setDialog({ open: true, editIdx: -1, startTime: '', endTime: '', selectedTags: [] })
  }

  function openEdit(idx: number) {
    const b = blocks[idx]
    setDialog({ open: true, editIdx: idx, startTime: b.startTime, endTime: b.endTime, selectedTags: [...b.tags] })
  }

  function toggleDialogTag(tag: Tag) {
    setDialog(prev => {
      const already = prev.selectedTags.some(t => t.id === tag.id)
      return {
        ...prev,
        selectedTags: already
          ? prev.selectedTags.filter(t => t.id !== tag.id)
          : [...prev.selectedTags, { id: tag.id, name: tag.tag_name, color: tag.color, emoji: tag.emoji }],
      }
    })
  }

  function removeDialogTag(id: string | undefined, name: string) {
    setDialog(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.filter(t => (id ? t.id !== id : t.name !== name)),
    }))
  }

  function saveBlock() {
    if (!dialog.startTime || !dialog.endTime) { toast.error('請填寫開始與結束時間'); return }
    if (dialog.selectedTags.length === 0)      { toast.error('請至少選擇一個標籤'); return }
    const newBlock: Block = { startTime: dialog.startTime, endTime: dialog.endTime, tags: dialog.selectedTags }
    setBlocks(prev => {
      const next = [...prev]
      if (dialog.editIdx >= 0) next[dialog.editIdx] = newBlock
      else next.push(newBlock)
      return next.sort((a, b) => a.startTime.localeCompare(b.startTime))
    })
    setDialog(EMPTY_DIALOG)
  }

  function deleteBlock() {
    setBlocks(prev => prev.filter((_, i) => i !== dialog.editIdx))
    setDialog(EMPTY_DIALOG)
  }

  const filteredTags = tags.filter(t => t.tag_name.includes(search))

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* 頂列 */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold"><Calendar className="w-5 h-5" /> 我的行程模板</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex items-center gap-1.5" onClick={() => setIsPublic(v => !v)}>
            {isPublic ? <><Unlock className="w-3.5 h-3.5" /> 公開中</> : <><Lock className="w-3.5 h-3.5" /> 私密</>}
          </Button>
          <Button size="sm" variant="outline" onClick={loadGroup}>群組行程</Button>
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={saveTemplate}>
            儲存模板
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
        {/* 左欄：標籤清單 */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋標籤"
              className="text-sm h-8 pl-7"
            />
          </div>
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setShowTag(true)}>
            + 新增標籤
          </Button>
          <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
            {filteredTags.map(tag => (
              <div
                key={tag.id}
                className="flex items-center justify-between rounded-lg border p-2 text-sm cursor-default hover:shadow-sm transition-shadow"
                style={{ borderLeftColor: tag.color, borderLeftWidth: 3 }}
              >
                <span>{tag.emoji} {tag.tag_name}</span>
                {!tag.is_system && (
                  <button onClick={() => deleteTag(tag)} className="text-muted-foreground hover:text-red-500 text-xs ml-1">×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 右欄：時間區段清單 */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-muted-foreground">
              時間區段（依開始時間排序，跨午夜會標示翌日）
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {blocks.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">尚無時間區段，點下方按鈕新增</p>
            )}

            {blocks.map((block, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between rounded-xl border border-white/60 bg-white/50 px-3 py-2.5 text-sm hover:bg-white/70 transition-colors"
              >
                <div className="flex items-baseline gap-2 flex-1 min-w-0">
                  {/* 時間 */}
                  <span className="font-mono text-xs text-muted-foreground shrink-0 tabular-nums">
                    {block.startTime}–{block.endTime}
                    {isCrossMidnight(block.startTime, block.endTime) && (
                      <span className="ml-1 text-amber-600 font-sans">翌日</span>
                    )}
                  </span>
                  {/* 標籤 */}
                  <span className="text-gray-700 truncate">
                    {block.tags.map((t, i) => (
                      <span key={i}>
                        {i > 0 && <span className="text-gray-300 mx-0.5">、</span>}
                        <span style={{ color: t.color }}>{t.emoji ? t.emoji + '\u00A0' : ''}</span>
                        <span>{t.name}</span>
                      </span>
                    ))}
                  </span>
                </div>
                <button
                  onClick={() => openEdit(idx)}
                  className="ml-2 shrink-0 text-muted-foreground hover:text-gray-700 p-0.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2 border-dashed text-muted-foreground hover:text-gray-700"
              onClick={openAdd}
            >
              + 新增時間區段
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 新增/編輯區段 Dialog */}
      <Dialog open={dialog.open} onOpenChange={open => { if (!open) setDialog(EMPTY_DIALOG) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog.editIdx >= 0 ? '編輯時間區段' : '新增時間區段'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 時間 */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">開始時間</Label>
                <Input
                  type="time"
                  value={dialog.startTime}
                  onChange={e => setDialog(d => ({ ...d, startTime: e.target.value }))}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">結束時間</Label>
                <Input
                  type="time"
                  value={dialog.endTime}
                  onChange={e => setDialog(d => ({ ...d, endTime: e.target.value }))}
                />
              </div>
            </div>
            {dialog.startTime && dialog.endTime && isCrossMidnight(dialog.startTime, dialog.endTime) && (
              <p className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> 跨午夜區段（翌日 {dialog.endTime} 結束）</p>
            )}

            {/* 可選標籤 */}
            <div className="space-y-1.5">
              <Label className="text-xs">點擊標籤加入</Label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {tags.map(tag => {
                  const selected = dialog.selectedTags.some(t => t.id === tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleDialogTag(tag)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-all',
                        selected
                          ? 'text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      )}
                      style={selected ? { background: tag.color, borderColor: tag.color } : {}}
                    >
                      {tag.emoji && <span>{tag.emoji}</span>}
                      <span>{tag.tag_name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 已選 */}
            {dialog.selectedTags.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">已選標籤</Label>
                <div className="flex flex-wrap gap-1.5">
                  {dialog.selectedTags.map((t, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-white"
                      style={{ background: t.color }}
                    >
                      {t.emoji && <span>{t.emoji}</span>}
                      <span>{t.name}</span>
                      <button
                        onClick={() => removeDialogTag(t.id, t.name)}
                        className="ml-0.5 opacity-70 hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按鈕 */}
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={saveBlock}>
                儲存
              </Button>
              <Button variant="outline" onClick={() => setDialog(EMPTY_DIALOG)}>取消</Button>
              {dialog.editIdx >= 0 && (
                <Button variant="destructive" onClick={deleteBlock}>刪除</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 新增標籤 Dialog */}
      <Dialog open={showTag} onOpenChange={setShowTag}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>新增標籤</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名稱</Label><Input value={tagName} onChange={e => setTagName(e.target.value)} placeholder="標籤名稱" /></div>
            <div className="space-y-1"><Label>Emoji（選填）</Label><Input value={tagEmoji} onChange={e => setTagEmoji(e.target.value)} placeholder="🌟" maxLength={2} /></div>
            <div className="space-y-1">
              <Label>顏色</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={cn('h-7 w-7 rounded-full border-2 transition-transform', tagColor === c ? 'border-gray-800 scale-110' : 'border-transparent')}
                    style={{ background: c }}
                    onClick={() => setTagColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={addTag}>新增</Button>
              <Button variant="outline" onClick={() => setShowTag(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 群組行程 Sheet */}
      <Sheet open={showGroup} onOpenChange={setShowGroup}>
        <SheetContent side="right" className="w-80 overflow-y-auto">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><Users className="w-4 h-4" /> 群組公開行程</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-6">
            {groupData.length === 0
              ? <p className="text-sm text-muted-foreground">目前沒有成員公開行程</p>
              : groupData.map((g, i) => (
                <div key={i}>
                  <p className="flex items-center gap-1.5 font-semibold text-sm mb-2"><Star className="w-4 h-4 text-amber-500 fill-amber-400" /> {g.memberName}</p>
                  <div className="space-y-1.5">
                    {g.blocks.map((b, j) => (
                      <div key={j} className="text-xs flex items-baseline gap-2">
                        <span className="font-mono text-muted-foreground shrink-0 tabular-nums">
                          {b.startTime}–{b.endTime}
                          {isCrossMidnight(b.startTime, b.endTime) && <span className="text-amber-600 ml-1">翌日</span>}
                        </span>
                        <span className="truncate text-gray-700">
                          {b.tags.map((t: BlockTag) => tagLabel(t)).join('、')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
