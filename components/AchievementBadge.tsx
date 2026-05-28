'use client'

import { Tooltip } from '@base-ui/react/tooltip'
import { ACHIEVEMENT_LIST } from '@/lib/constants'
import { AppIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

type AchievementTier = 'bronze' | 'silver' | 'gold' | 'legendary' | 'special'

const TIER_STYLES: Record<AchievementTier, { bg: string; ring: string; icon: string; shine: string }> = {
  bronze:    { bg: '#fef0e6', ring: '#cd7f32', icon: '#92400e', shine: 'rgba(205,127,50,0.2)' },
  silver:    { bg: '#f3f4f6', ring: '#9ca3af', icon: '#4b5563', shine: 'rgba(156,163,175,0.2)' },
  gold:      { bg: '#fffbeb', ring: '#f59e0b', icon: '#b45309', shine: 'rgba(245,158,11,0.2)' },
  legendary: { bg: '#f5f3ff', ring: '#7c3aed', icon: '#5b21b6', shine: 'rgba(124,58,237,0.2)' },
  special:   { bg: '#f0fdf4', ring: '#16a34a', icon: '#15803d', shine: 'rgba(22,163,74,0.2)' },
}

const LOCKED_STYLE = { bg: '#f3f4f6', ring: '#d1d5db', icon: '#9ca3af', shine: 'transparent' }

// Hexagon points: pointed-top, viewBox 0 0 48 52
const HEX_OUTER = '24,2 45,14 45,38 24,50 3,38 3,14'
const HEX_INNER = '24,5.5 42.5,16 42.5,36 24,46.5 5.5,36 5.5,16'

type Achievement = typeof ACHIEVEMENT_LIST[number]

function getAchievementTier(ach: Achievement): AchievementTier {
  if (ach.type === 'streak') {
    const days = (ach as { days: number }).days
    if (days === 3)   return 'bronze'
    if (days === 7)   return 'silver'
    if (days === 30)  return 'gold'
    if (days === 100) return 'legendary'
  }
  return 'special'
}

interface BadgeTileProps {
  ach: Achievement
  unlocked: boolean
  size?: 'sm' | 'md'
}

function BadgeTile({ ach, unlocked, size = 'md' }: BadgeTileProps) {
  const tier   = getAchievementTier(ach)
  const style  = unlocked ? TIER_STYLES[tier] : LOCKED_STYLE
  const isSm   = size === 'sm'
  const iconSz = isSm ? 'w-3.5 h-3.5' : 'w-5 h-5'

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <div
            className={cn(
              'flex flex-col items-center cursor-help',
              isSm ? 'w-8' : 'w-14',
            )}
          >
            {/* 六角徽章（固定高度，圖示絕對置中） */}
            <div className={isSm ? 'relative w-8 h-9 shrink-0' : 'relative w-12 h-[3.25rem] shrink-0'}>
              <svg viewBox="0 0 48 52" className="absolute inset-0 w-full h-full" aria-hidden>
                <polygon points={HEX_OUTER} fill={style.bg} stroke={style.ring} strokeWidth="2.5" />
                <polygon points={HEX_INNER} fill={style.shine} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center" style={{ color: style.icon }}>
                <AppIcon name={ach.badge} className={iconSz} />
              </div>
            </div>

            {/* 名稱獨立一列 */}
            {!isSm && (
              <div
                className="mt-1 w-full text-[0.6rem] leading-tight text-center break-words"
                style={{ color: unlocked ? style.ring : '#9ca3af' }}
              >
                {ach.name}
              </div>
            )}
          </div>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup className="rounded-lg bg-white border shadow-lg p-3 max-w-xs z-50 text-left">
            <div className="font-semibold text-sm" style={{ color: style.ring }}>{ach.name}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">{ach.description}</div>
            <div className={cn('text-xs mt-2 font-medium', unlocked ? 'text-green-600' : 'text-gray-400')}>
              {unlocked ? '✓ 已解鎖' : '🔒 尚未解鎖'}
            </div>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

interface AchievementWallProps {
  unlockedCodes: string[]
}

export function AchievementWall({ unlockedCodes }: AchievementWallProps) {
  const unlockedSet = new Set(unlockedCodes)
  return (
    <Tooltip.Provider delay={150} closeDelay={100}>
      <div className="flex flex-wrap gap-2">
        {ACHIEVEMENT_LIST.map(ach => (
          <BadgeTile key={ach.code} ach={ach} unlocked={unlockedSet.has(ach.code)} />
        ))}
      </div>
    </Tooltip.Provider>
  )
}

export { BadgeTile, getAchievementTier }
export type { AchievementTier }
