import {
  Moon, Dumbbell, Activity, Sun, Briefcase, Leaf, BookOpen, Wind,
  Sunrise, Star, Calendar, Medal, Award, CheckCircle2, Flame, Trophy,
  PartyPopper, Crown, BarChart3, TrendingUp, Unlock, Lock,
  Search, Pencil, AlertTriangle, Users, Clipboard, X,
  type LucideIcon,
} from 'lucide-react'

export const ICON_MAP: Record<string, LucideIcon> = {
  Moon, Dumbbell, Activity, Sun, Briefcase, Leaf, BookOpen, Wind,
  Sunrise, Star, Calendar, Medal, Award, CheckCircle2, Flame, Trophy,
  PartyPopper, Crown, BarChart3, TrendingUp, Unlock, Lock,
  Search, Pencil, AlertTriangle, Users, Clipboard, X,
}

interface AppIconProps {
  name: string
  className?: string
}

export function AppIcon({ name, className = 'w-5 h-5' }: AppIconProps) {
  const Icon = ICON_MAP[name]
  if (!Icon) return null
  return <Icon className={className} />
}

export function TaskIcon({ image, name, className = 'w-6 h-6' }: {
  image?: string
  name: string
  className?: string
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt={name} className={className} style={{ mixBlendMode: 'multiply' }} />
    )
  }
  return <AppIcon name={name} className={className} />
}
