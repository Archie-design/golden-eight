'use client'

import { cn } from '@/lib/utils'

interface BlockTag { name: string; color: string; emoji?: string }
interface Block { startTime: string; endTime: string; tags: BlockTag[] }

// Convert "HH:MM" to minutes from midnight
function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// 24 h = 1440 min; we display 00:00–24:00 top-to-bottom
const TOTAL_MIN = 24 * 60

// Hour labels shown on the left ruler
const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

export function TimelineView({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        尚無時間區段，請先在列表模式新增
      </p>
    )
  }

  return (
    <div className="relative flex gap-0 select-none" style={{ minHeight: 600 }}>
      {/* Hour ruler */}
      <div className="relative w-10 shrink-0">
        {HOUR_LABELS.map(h => (
          <div
            key={h}
            className="absolute right-1 text-[10px] text-muted-foreground tabular-nums leading-none"
            style={{ top: `${(h * 60 / TOTAL_MIN) * 100}%`, transform: 'translateY(-50%)' }}
          >
            {String(h).padStart(2, '0')}
          </div>
        ))}
      </div>

      {/* Timeline column */}
      <div className="relative flex-1 border-l border-gray-200">
        {/* Horizontal hour grid lines */}
        {HOUR_LABELS.map(h => (
          <div
            key={h}
            className={cn(
              'absolute left-0 right-0 border-t',
              h % 6 === 0 ? 'border-gray-300' : 'border-gray-100',
            )}
            style={{ top: `${(h * 60 / TOTAL_MIN) * 100}%` }}
          />
        ))}

        {/* Time blocks */}
        {blocks.map((block, idx) => {
          const startMin = toMin(block.startTime)
          let   endMin   = toMin(block.endTime)
          // Cross-midnight: end is next day
          if (endMin <= startMin) endMin += TOTAL_MIN

          // Clamp to 24h display
          const clampedEnd = Math.min(endMin, TOTAL_MIN)
          const topPct     = (startMin / TOTAL_MIN) * 100
          const heightPct  = ((clampedEnd - startMin) / TOTAL_MIN) * 100

          // Pick a readable text colour: light bg → dark text
          const mainColor = block.tags[0]?.color ?? '#f59e0b'

          return (
            <div
              key={idx}
              className="absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden shadow-sm border border-white/60"
              style={{
                top:        `${topPct}%`,
                height:     `${Math.max(heightPct, 2.5)}%`,
                background: mainColor + 'cc',   // 80% opacity
                minHeight:  20,
              }}
            >
              <div className="flex flex-col h-full justify-start gap-0.5">
                <span className="text-[10px] font-mono text-white/90 leading-none tabular-nums">
                  {block.startTime}–{block.endTime}
                  {endMin > TOTAL_MIN && ' 翌日'}
                </span>
                <div className="flex flex-wrap gap-0.5">
                  {block.tags.map((t, i) => (
                    <span
                      key={i}
                      className="text-[9px] leading-none rounded-full px-1.5 py-0.5 bg-white/30 text-white font-medium truncate max-w-[90px]"
                    >
                      {t.emoji ? `${t.emoji} ` : ''}{t.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
