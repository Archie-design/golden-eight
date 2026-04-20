'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface BlockTag { name: string; color: string; emoji?: string }
interface Block { startTime: string; endTime: string; tags: BlockTag[] }

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getNowMin() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b <= 0.35
}

type PlacedBlock = Block & { startMin: number; endMin: number; col: number; numCols: number }

function assignColumns(blocks: Block[]): PlacedBlock[] {
  const withMin = blocks.map(b => {
    const s = toMin(b.startTime)
    let   e = toMin(b.endTime)
    if (e <= s) e += 24 * 60
    return { ...b, startMin: s, endMin: e }
  }).sort((a, b) => a.startMin - b.startMin)

  const colEnd: number[] = []

  const placed = withMin.map(b => {
    let col = colEnd.findIndex(end => end <= b.startMin)
    if (col === -1) { col = colEnd.length; colEnd.push(b.endMin) }
    else             colEnd[col] = b.endMin
    return { ...b, col, numCols: 0 }
  })

  for (const b of placed) {
    let max = b.col + 1
    for (const o of placed) {
      if (o !== b && o.startMin < b.endMin && o.endMin > b.startMin) {
        max = Math.max(max, o.col + 1)
      }
    }
    b.numCols = max
  }

  return placed
}

const PRESETS = [
  { label: '全天',   start:  0, end: 24 },
  { label: '清晨',   start:  4, end: 10 },
  { label: '白天',   start:  8, end: 18 },
  { label: '晚間',   start: 17, end: 24 },
]

const HOUR_OPTIONS_START = Array.from({ length: 24 }, (_, i) => i)
const HOUR_OPTIONS_END   = Array.from({ length: 24 }, (_, i) => i + 1)

export function TimelineView({ blocks }: { blocks: Block[] }) {
  const [nowMin,    setNowMin]    = useState(getNowMin)
  const [viewStart, setViewStart] = useState(0)
  const [viewEnd,   setViewEnd]   = useState(24)
  const [tooltip,   setTooltip]   = useState<{ block: PlacedBlock; x: number; y: number } | null>(null)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setNowMin(getNowMin()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        尚無時間區段，請先在列表模式新增
      </p>
    )
  }

  const viewStartMin = viewStart * 60
  const viewEndMin   = viewEnd   * 60
  const viewRangeMin = viewEndMin - viewStartMin

  const placed = assignColumns(blocks)

  // Visible hours for ruler and grid
  const visibleHours = Array.from(
    { length: viewEnd - viewStart + 1 },
    (_, i) => viewStart + i
  )

  // Decide label density based on range size
  const rangeSizeH   = viewEnd - viewStart
  const labelEvery   = rangeSizeH <= 4 ? 1 : rangeSizeH <= 8 ? 1 : 2

  // Now line: only show if within view range
  const nowVisible = nowMin >= viewStartMin && nowMin <= viewEndMin
  const nowPct     = ((nowMin - viewStartMin) / viewRangeMin) * 100

  function applyPreset(start: number, end: number) {
    setViewStart(start)
    setViewEnd(end)
  }

  function handleStartChange(h: number) {
    setViewStart(h)
    if (h >= viewEnd) setViewEnd(Math.min(h + 1, 24))
  }

  function handleEndChange(h: number) {
    setViewEnd(h)
    if (h <= viewStart) setViewStart(Math.max(h - 1, 0))
  }

  return (
    <div className="space-y-3">
      {/* Range controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>顯示</span>
          <select
            value={viewStart}
            onChange={e => handleStartChange(Number(e.target.value))}
            className="border rounded px-1.5 py-0.5 text-sm bg-white"
          >
            {HOUR_OPTIONS_START.map(h => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
          <span>–</span>
          <select
            value={viewEnd}
            onChange={e => handleEndChange(Number(e.target.value))}
            className="border rounded px-1.5 py-0.5 text-sm bg-white"
          >
            {HOUR_OPTIONS_END.map(h => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.start, p.end)}
              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                viewStart === p.start && viewEnd === p.end
                  ? 'bg-yellow-400 border-yellow-400 text-white font-medium'
                  : 'bg-white border-gray-200 text-muted-foreground hover:border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative flex gap-0 select-none" style={{ minHeight: Math.max(300, rangeSizeH * 50) }}>
        {/* Hour ruler */}
        <div className="relative w-12 shrink-0">
          {visibleHours.map(h => {
            const showLabel = (h - viewStart) % labelEvery === 0
            const topPct = ((h - viewStart) * 60 / viewRangeMin) * 100
            return showLabel ? (
              <div
                key={h}
                className="absolute right-2 text-[11px] text-muted-foreground tabular-nums leading-none"
                style={{ top: `${topPct}%`, transform: 'translateY(-50%)' }}
              >
                {String(h).padStart(2, '0')}
              </div>
            ) : null
          })}
          {/* Now label */}
          {nowVisible && (
            <div
              className="absolute right-1 text-[10px] text-red-500 font-bold tabular-nums leading-none z-10"
              style={{ top: `${nowPct}%`, transform: 'translateY(-50%)' }}
            >
              {String(Math.floor(nowMin / 60)).padStart(2, '0')}:{String(nowMin % 60).padStart(2, '0')}
            </div>
          )}
        </div>

        {/* Timeline column */}
        <div className="relative flex-1 border-l border-gray-200">
          {/* Grid lines */}
          {visibleHours.map(h => {
            const topPct = ((h - viewStart) * 60 / viewRangeMin) * 100
            return (
              <div
                key={h}
                className="absolute left-0 right-0 border-t"
                style={{
                  top: `${topPct}%`,
                  borderColor: h % 6 === 0 ? '#d1d5db' : h % 2 === 0 ? '#e5e7eb' : '#f3f4f6',
                }}
              />
            )
          })}

          {/* Now red line */}
          {nowVisible && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: `${nowPct}%` }}
            >
              <div className="border-t-2 border-red-500" />
              <div
                className="absolute -top-1 left-0 w-2 h-2 rounded-full bg-red-500"
                style={{ transform: 'translateX(-50%)' }}
              />
            </div>
          )}

          {/* Time blocks */}
          {placed.map((block, idx) => {
            // Skip blocks entirely outside the view
            const clampedEnd = Math.min(block.endMin, 24 * 60)
            if (clampedEnd <= viewStartMin || block.startMin >= viewEndMin) return null

            const effectiveStart = Math.max(block.startMin, viewStartMin)
            const effectiveEnd   = Math.min(clampedEnd, viewEndMin)
            const topPct         = ((effectiveStart - viewStartMin) / viewRangeMin) * 100
            const heightPct      = ((effectiveEnd - effectiveStart) / viewRangeMin) * 100
            const isTruncatedTop = block.startMin < viewStartMin
            const isShort        = heightPct < 3.5

            const mainColor = block.tags[0]?.color ?? '#f59e0b'
            const dark      = isDark(mainColor)
            const textColor = dark ? 'text-white' : 'text-gray-800'
            const widthPct  = 100 / block.numCols
            const leftPct   = (block.col / block.numCols) * 100

            return (
              <div
                key={idx}
                className="absolute overflow-hidden shadow-sm border border-white/40 cursor-default"
                style={{
                  top:        `${topPct}%`,
                  height:     `${Math.max(heightPct, 1.5)}%`,
                  left:       `${leftPct}%`,
                  width:      `calc(${widthPct}% - 3px)`,
                  marginLeft: '1px',
                  background: mainColor + 'dd',
                  minHeight:  18,
                  borderRadius: isTruncatedTop ? '0 0 6px 6px' : '6px',
                }}
                onMouseEnter={e => setTooltip({ block, x: e.clientX, y: e.clientY })}
                onMouseMove={e  => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)}
                onMouseLeave={()  => setTooltip(null)}
              >
                <div className={`flex flex-col h-full justify-start gap-0.5 px-1.5 py-1 ${textColor}`}>
                  <span className="text-xs font-mono leading-none tabular-nums opacity-90 shrink-0">
                    {block.startTime}–{block.endTime}
                    {block.endMin > 24 * 60 && <span className="ml-0.5 opacity-70">翌</span>}
                    {isTruncatedTop && <span className="ml-0.5 opacity-70">↑繼續</span>}
                  </span>
                  {!isShort && (
                    <div className="flex flex-wrap gap-0.5">
                      {block.tags.map((t, i) => (
                        <span
                          key={i}
                          className="text-[11px] leading-none rounded-full px-1.5 py-0.5 bg-black/15 truncate max-w-[100px]"
                        >
                          {t.emoji ? `${t.emoji} ` : ''}{t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tooltip — portal to document.body so it escapes all stacking contexts */}
      {mounted && tooltip && createPortal(
        (() => {
          const b        = tooltip.block
          const durMin   = Math.min(b.endMin, 24 * 60) - b.startMin
          const durLabel = durMin >= 60
            ? `${Math.floor(durMin / 60)} 小時${durMin % 60 ? ` ${durMin % 60} 分` : ''}`
            : `${durMin} 分鐘`
          const flipLeft = tooltip.x > window.innerWidth  - 220
          const flipUp   = tooltip.y > window.innerHeight - 160
          return (
            <div
              className="fixed z-[9999] pointer-events-none rounded-xl shadow-xl border border-gray-200 bg-white p-3 text-sm min-w-[160px] max-w-[220px]"
              style={{
                left:      flipLeft ? tooltip.x - 12 : tooltip.x + 14,
                top:       flipUp   ? tooltip.y - 8  : tooltip.y + 8,
                transform: `${flipLeft ? 'translateX(-100%)' : ''}${flipUp ? ' translateY(-100%)' : ''}`,
              }}
            >
              <div className="font-mono font-semibold text-gray-800 mb-1">
                {b.startTime} – {b.endTime}
                {b.endMin > 24 * 60 && <span className="ml-1 text-amber-500 text-xs">翌日</span>}
              </div>
              <div className="text-xs text-muted-foreground mb-2">{durLabel}</div>
              {b.tags.length > 0 && (
                <div className="flex flex-col gap-1">
                  {b.tags.map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      <span className="text-gray-700 text-xs">
                        {t.emoji ? `${t.emoji} ` : ''}{t.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })(),
        document.body
      )}
    </div>
  )
}
