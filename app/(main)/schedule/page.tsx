'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface Tag { id: string; tag_name: string; color: string; emoji?: string; is_system: boolean }
interface Entry { id?: number; tagId?: string; tagName: string; color: string; startTime: string; endTime: string; note?: string }
interface PublicSchedule { memberName: string; entries: Entry[] }

const COLORS = ['#4A90D9','#E17055','#00B894','#FDCB6E','#6C5CE7','#A29BFE','#FD79A8','#55EFC4']
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5)  // 05:00 – 23:00
const CELL_HEIGHT = 32  // px per 15min

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`
}

export default function SchedulePage() {
  const [tags,      setTags]      = useState<Tag[]>([])
  const [entries,   setEntries]   = useState<Entry[]>([])
  const [isPublic,  setIsPublic]  = useState(false)
  const [search,    setSearch]    = useState('')
  const [showTag,   setShowTag]   = useState(false)
  const [showGroup, setShowGroup] = useState(false)
  const [groupData, setGroupData] = useState<PublicSchedule[]>([])
  const [tagName,   setTagName]   = useState('')
  const [tagColor,  setTagColor]  = useState(COLORS[0])
  const [tagEmoji,  setTagEmoji]  = useState('')
  const [selected,  setSelected]  = useState<Entry | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    const res  = await fetch('/api/schedule/data')
    const json = await res.json()
    if (json.ok) { setTags(json.tags); setEntries(json.entries); setIsPublic(json.isPublic) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function saveTemplate() {
    const res  = await fetch('/api/schedule/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, isPublic }),
    })
    const json = await res.json()
    toast[json.ok ? 'success' : 'error'](json.msg)
  }

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
    if (json.ok) { setTags(prev => prev.filter(t => t.id !== tag.id)); setEntries(prev => prev.filter(e => e.tagId !== tag.id)) }
    else toast.error(json.msg)
  }

  async function loadGroup() {
    const res  = await fetch('/api/schedule/public')
    const json = await res.json()
    if (json.ok) setGroupData(json.schedules)
    setShowGroup(true)
  }

  // 拖拉放置：點擊時間軸空格直接新增 30 分鐘
  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = timelineRef.current!.getBoundingClientRect()
    const y    = e.clientY - rect.top
    const minFromTop = Math.round(y / CELL_HEIGHT) * 15
    const absMin = 5 * 60 + minFromTop
    const startTime = minutesToTime(Math.min(absMin, 22 * 60 + 45))
    const endTime   = minutesToTime(Math.min(absMin + 30, 23 * 60))
    setEntries(prev => [...prev, { tagName: '新活動', color: COLORS[0], startTime, endTime }])
  }

  // Drop a tag onto timeline
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const tagId   = e.dataTransfer.getData('tagId')
    const tag     = tags.find(t => t.id === tagId)
    if (!tag) return
    const rect    = timelineRef.current!.getBoundingClientRect()
    const y       = e.clientY - rect.top
    const minFrom = Math.round(y / CELL_HEIGHT) * 15
    const absMin  = 5 * 60 + minFrom
    const startTime = minutesToTime(Math.min(absMin, 22 * 60 + 45))
    const endTime   = minutesToTime(Math.min(absMin + 30, 23 * 60))
    setEntries(prev => [...prev, { tagId: tag.id, tagName: tag.tag_name, color: tag.color, startTime, endTime }])
  }

  const filteredTags = tags.filter(t => t.tag_name.includes(search))

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* 頂列操作 */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h1 className="text-lg font-bold">📅 我的行程模板</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsPublic(v => !v)}>
            {isPublic ? '🔓 公開中' : '🔒 私密'}
          </Button>
          <Button size="sm" variant="outline" onClick={loadGroup}>群組行程</Button>
          <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={saveTemplate}>儲存模板</Button>
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-4">
        {/* 左欄：標籤清單 */}
        <div className="space-y-2">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 搜尋標籤"
            className="text-sm h-8"
          />
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setShowTag(true)}>
            + 新增標籤
          </Button>
          <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
            {filteredTags.map(tag => (
              <div
                key={tag.id}
                draggable
                onDragStart={e => e.dataTransfer.setData('tagId', tag.id)}
                className="flex items-center justify-between rounded-lg border p-2 text-sm cursor-grab hover:shadow-sm transition-shadow"
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

        {/* 右欄：時間軸 */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-sm text-muted-foreground">拖拉標籤到時軸，或點擊空格新增</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto" style={{ maxHeight: 560 }}>
            <div
              ref={timelineRef}
              className="relative"
              style={{ height: HOURS.length * 4 * CELL_HEIGHT }}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={handleTimelineClick}
            >
              {/* 時間格線 */}
              {HOURS.map(h => (
                <div key={h} className="absolute w-full" style={{ top: (h - 5) * 4 * CELL_HEIGHT }}>
                  <div className="flex items-center">
                    <span className="text-xs text-muted-foreground w-12 pl-2 shrink-0">{String(h).padStart(2,'0')}:00</span>
                    <div className="flex-1 border-t border-gray-100" />
                  </div>
                </div>
              ))}

              {/* 行程色塊 */}
              {entries.map((entry, i) => {
                const top    = (timeToMinutes(entry.startTime) - 5 * 60) / 15 * CELL_HEIGHT
                const height = (timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime)) / 15 * CELL_HEIGHT
                return (
                  <div
                    key={i}
                    className="absolute left-12 right-2 rounded px-2 py-0.5 text-xs text-white cursor-pointer hover:opacity-90 shadow-sm overflow-hidden"
                    style={{ top, height: Math.max(height, CELL_HEIGHT), background: entry.color }}
                    onClick={e => { e.stopPropagation(); setSelected(entry) }}
                  >
                    <div className="font-semibold truncate">{entry.tagName}</div>
                    <div className="opacity-80">{entry.startTime}–{entry.endTime}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 新增標籤 Modal */}
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
              <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={addTag}>新增</Button>
              <Button variant="outline" onClick={() => setShowTag(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 色塊編輯 */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-xs">
            <DialogHeader><DialogTitle>{selected.tagName}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="space-y-1 flex-1"><Label>開始</Label>
                  <Input type="time" value={selected.startTime}
                    onChange={e => setSelected(s => s ? {...s, startTime: e.target.value} : s)} />
                </div>
                <div className="space-y-1 flex-1"><Label>結束</Label>
                  <Input type="time" value={selected.endTime}
                    onChange={e => setSelected(s => s ? {...s, endTime: e.target.value} : s)} />
                </div>
              </div>
              <div className="space-y-1"><Label>備註</Label>
                <Input value={selected.note ?? ''} onChange={e => setSelected(s => s ? {...s, note: e.target.value} : s)} placeholder="選填備註" />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => {
                  setEntries(prev => prev.map(e => e === selected || (e.startTime === selected.startTime && e.tagName === selected.tagName) ? selected : e))
                  setSelected(null)
                }}>儲存</Button>
                <Button variant="destructive" onClick={() => {
                  setEntries(prev => prev.filter(e => !(e.startTime === selected.startTime && e.tagName === selected.tagName)))
                  setSelected(null)
                }}>刪除</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 群組行程 Sheet */}
      <Sheet open={showGroup} onOpenChange={setShowGroup}>
        <SheetContent side="right" className="w-80 overflow-y-auto">
          <SheetHeader><SheetTitle>👥 群組公開行程</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4">
            {groupData.length === 0
              ? <p className="text-sm text-muted-foreground">目前沒有成員公開行程</p>
              : groupData.map((g, i) => (
                <div key={i}>
                  <p className="font-semibold text-sm mb-2">🌟 {g.memberName}</p>
                  {g.entries.map((e, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm mb-1">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} />
                      <span>{e.startTime}–{e.endTime}</span>
                      <span className="text-muted-foreground truncate">{e.tagName}</span>
                    </div>
                  ))}
                </div>
              ))
            }
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
