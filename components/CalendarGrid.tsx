'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CalendarDay {
  date:  string
  day:   number
  score: number | null
  color: string
  note?: string
}

interface CalendarGridProps {
  days: CalendarDay[]
}

const DOW = ['日', '一', '二', '三', '四', '五', '六']

export function CalendarGrid({ days }: CalendarGridProps) {
  const [selected, setSelected] = useState<CalendarDay | null>(null)

  if (!days.length) return null

  const firstDow = new Date(days[0].date + 'T00:00:00+08:00').getDay()

  function handleClick(day: CalendarDay) {
    if (!day.note) { setSelected(null); return }
    setSelected(prev => prev?.date === day.date ? null : day)
  }

  return (
    <div>
      {/* 圖例 */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-100" />未報</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-100" />0–4分</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-orange-100" />5–6分</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-100" />7分</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-yellow-300" />8+分</span>
      </div>

      {/* 星期標題 */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* 日期格 */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={'pad' + i} />
        ))}
        {days.map(day => {
          const hasNote = !!day.note
          const isSelected = selected?.date === day.date
          return (
            <div
              key={day.date}
              title={day.score !== null ? `${day.date}: ${day.score} 分` : day.date}
              onClick={() => handleClick(day)}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded text-sm font-medium',
                day.color,
                hasNote ? 'cursor-pointer' : 'cursor-default',
                isSelected && 'ring-2 ring-amber-400 ring-offset-1',
              )}
            >
              {day.day}
              {hasNote && (
                <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
            </div>
          )
        })}
      </div>

      {/* 備註面板 */}
      {selected && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          <span className="mr-2 text-xs font-medium text-amber-600">{selected.date}</span>
          <span className="text-gray-700">{selected.note}</span>
        </div>
      )}
    </div>
  )
}
