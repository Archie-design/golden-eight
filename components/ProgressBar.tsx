import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number   // 0-100
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ value, className, showLabel = true }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const color = clamped >= 80 ? 'bg-yellow-400' : clamped >= 60 ? 'bg-green-400' : 'bg-red-400'

  return (
    <div className={cn('space-y-1', className)}>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <div className="text-right text-xs text-muted-foreground">{clamped}%</div>
      )}
    </div>
  )
}
