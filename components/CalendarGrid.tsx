import { cn } from '@/lib/utils'

interface CalendarDay {
  date:  string
  day:   number
  score: number | null
  color: string
}

interface CalendarGridProps {
  days: CalendarDay[]
}

const DOW = ['日', '一', '二', '三', '四', '五', '六']

export function CalendarGrid({ days }: CalendarGridProps) {
  if (!days.length) return null

  const firstDow = new Date(days[0].date + 'T00:00:00+08:00').getDay()

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
        {days.map(day => (
          <div
            key={day.date}
            title={day.score !== null ? `${day.date}: ${day.score} 分` : day.date}
            className={cn(
              'flex aspect-square items-center justify-center rounded text-sm font-medium cursor-default',
              day.color
            )}
          >
            {day.day}
          </div>
        ))}
      </div>
    </div>
  )
}
