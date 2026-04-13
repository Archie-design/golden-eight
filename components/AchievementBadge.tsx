import { cn } from '@/lib/utils'
import { ACHIEVEMENT_LIST } from '@/lib/constants'

interface AchievementBadgeProps {
  unlockedCodes: string[]
}

export function AchievementWall({ unlockedCodes }: AchievementBadgeProps) {
  const unlockedSet = new Set(unlockedCodes)

  return (
    <div className="flex flex-wrap gap-2">
      {ACHIEVEMENT_LIST.map(ach => {
        const isUnlocked = unlockedSet.has(ach.code)
        const parts = ach.name.split(' ')
        const badge = parts.at(-1) ?? '🏆'
        const label = ach.name.replace(badge, '').trim()

        return (
          <div
            key={ach.code}
            title={ach.name}
            className={cn(
              'flex w-16 flex-col items-center rounded-lg border p-2 text-center transition-all',
              isUnlocked
                ? 'border-yellow-300 bg-yellow-50 shadow-sm'
                : 'border-gray-100 bg-gray-50 opacity-30 grayscale'
            )}
          >
            <div className="text-2xl leading-none">{badge}</div>
            <div className="mt-1 text-[0.6rem] leading-tight text-muted-foreground">{label}</div>
          </div>
        )
      })}
    </div>
  )
}
