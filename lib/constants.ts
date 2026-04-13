// ============================================================
// 黃金八套餐 — 系統常數
// ============================================================

export const TASKS = [
  { name: '早睡早起',      icon: '🌙', desc: '12 前入睡，早上 7 前起床' },
  { name: '破曉打拳',      icon: '🥊', desc: '日出後 10 分鐘內完成' },
  { name: '丹氣跑步 15 分鐘', icon: '🏃', desc: '雨天可室內跑步' },
  { name: '曬太陽',         icon: '☀️', desc: '陰雨天不計分' },
  { name: '工作 8 小時',   icon: '💼', desc: '月累計 160 小時以上' },
  { name: '不吃肉',         icon: '🥗', desc: '各素食級別皆可' },
  { name: '寫觀心書',       icon: '📖', desc: '一階可寫覺察日記' },
  { name: '淨心功法',       icon: '🧘', desc: '睡前效果更好' },
] as const

export const LEVEL_THRESHOLDS: Record<string, number> = {
  '黃金戰士': 0.80,
  '白銀戰士': 0.70,
  '青銅戰士': 0.60,
}

export const LEVEL_PENALTIES: Record<string, number> = {
  '黃金戰士': 200,
  '白銀戰士': 300,
  '青銅戰士': 400,
}

export const ACHIEVEMENT_LIST = [
  // 各任務連續天數（8 項 × 4 里程碑 = 32 個）
  { code: 'T1_STREAK_3',   name: '早鳥初心 🌅',    type: 'streak', task: 0, days: 3   },
  { code: 'T1_STREAK_7',   name: '早鳥習慣 🌅',    type: 'streak', task: 0, days: 7   },
  { code: 'T1_STREAK_30',  name: '早鳥達人 🌅',    type: 'streak', task: 0, days: 30  },
  { code: 'T1_STREAK_100', name: '早鳥百日 🌅',    type: 'streak', task: 0, days: 100 },
  { code: 'T2_STREAK_3',   name: '破曉初煉 🥊',    type: 'streak', task: 1, days: 3   },
  { code: 'T2_STREAK_7',   name: '破曉星火 🥊',    type: 'streak', task: 1, days: 7   },
  { code: 'T2_STREAK_30',  name: '破曉月將 🥊',    type: 'streak', task: 1, days: 30  },
  { code: 'T2_STREAK_100', name: '破曉百日俠 🥊',  type: 'streak', task: 1, days: 100 },
  { code: 'T3_STREAK_3',   name: '跑步初動 🏃',    type: 'streak', task: 2, days: 3   },
  { code: 'T3_STREAK_7',   name: '跑步習慣 🏃',    type: 'streak', task: 2, days: 7   },
  { code: 'T3_STREAK_30',  name: '跑步達人 🏃',    type: 'streak', task: 2, days: 30  },
  { code: 'T3_STREAK_100', name: '百日跑者 🏃',    type: 'streak', task: 2, days: 100 },
  { code: 'T4_STREAK_3',   name: '初曬太陽 ☀️',   type: 'streak', task: 3, days: 3   },
  { code: 'T4_STREAK_7',   name: '陽光習慣 ☀️',   type: 'streak', task: 3, days: 7   },
  { code: 'T4_STREAK_30',  name: '陽光達人 ☀️',   type: 'streak', task: 3, days: 30  },
  { code: 'T4_STREAK_100', name: '百日暖陽 ☀️',   type: 'streak', task: 3, days: 100 },
  { code: 'T5_STREAK_3',   name: '勤奮初心 💼',    type: 'streak', task: 4, days: 3   },
  { code: 'T5_STREAK_7',   name: '勤奮習慣 💼',    type: 'streak', task: 4, days: 7   },
  { code: 'T5_STREAK_30',  name: '職人達人 💼',    type: 'streak', task: 4, days: 30  },
  { code: 'T5_STREAK_100', name: '職人百日 💼',    type: 'streak', task: 4, days: 100 },
  { code: 'T6_STREAK_3',   name: '素心初願 🥗',    type: 'streak', task: 5, days: 3   },
  { code: 'T6_STREAK_7',   name: '素心習慣 🥗',    type: 'streak', task: 5, days: 7   },
  { code: 'T6_STREAK_30',  name: '素食達人 🥗',    type: 'streak', task: 5, days: 30  },
  { code: 'T6_STREAK_100', name: '素食百日 🥗',    type: 'streak', task: 5, days: 100 },
  { code: 'T7_STREAK_3',   name: '觀心初啟 📖',    type: 'streak', task: 6, days: 3   },
  { code: 'T7_STREAK_7',   name: '觀心習慣 📖',    type: 'streak', task: 6, days: 7   },
  { code: 'T7_STREAK_30',  name: '觀心達人 📖',    type: 'streak', task: 6, days: 30  },
  { code: 'T7_STREAK_100', name: '觀心百日 📖',    type: 'streak', task: 6, days: 100 },
  { code: 'T8_STREAK_3',   name: '淨心初動 🧘',    type: 'streak', task: 7, days: 3   },
  { code: 'T8_STREAK_7',   name: '淨心習慣 🧘',    type: 'streak', task: 7, days: 7   },
  { code: 'T8_STREAK_30',  name: '淨心達人 🧘',    type: 'streak', task: 7, days: 30  },
  { code: 'T8_STREAK_100', name: '淨心百日 🧘',    type: 'streak', task: 7, days: 100 },
  // 單日特殊
  { code: 'FIRST_CHECKIN',        name: '萬里起行 🎉',   type: 'first'         },
  { code: 'DAILY_PERFECT',        name: '大滿貫 🌟',      type: 'perfect'       },
  { code: 'DAILY_PERFECT_BONUS',  name: '金色大滿貫 ⭐',  type: 'perfect_bonus' },
  // 累積里程碑
  { code: 'CHECKIN_30',   name: '打卡 30 天 📅',  type: 'cumulative',    target: 30  },
  { code: 'CHECKIN_100',  name: '打卡百日 📅',    type: 'cumulative',    target: 100 },
  { code: 'CHECKIN_365',  name: '打卡一年 📅',    type: 'cumulative',    target: 365 },
  { code: 'PERFECT_10',   name: '大滿貫 x10 🌟', type: 'perfect_count', target: 10  },
  { code: 'PERFECT_30',   name: '大滿貫 x30 🌟', type: 'perfect_count', target: 30  },
  // 月度成就
  { code: 'MONTH_PASS',     name: '初次通關 🎖️', type: 'month_first'           },
  { code: 'MONTH_GOLD',     name: '黃金通關 🥇',  type: 'month_gold'            },
  { code: 'MONTH_PERFECT',  name: '完美月 💯',    type: 'month_rate', rate: 100 },
  { code: 'MONTH_STREAK_3', name: '三月連勝 🔥',  type: 'month_streak', n: 3   },
  { code: 'MONTH_STREAK_6', name: '半年英雄 🏆',  type: 'month_streak', n: 6   },
]

export const CALENDAR_COLORS = {
  none:   'bg-gray-100 text-gray-400',
  low:    'bg-red-100 text-red-700',
  mid:    'bg-orange-100 text-orange-700',
  good:   'bg-green-100 text-green-700',
  gold:   'bg-yellow-300 text-yellow-900',
}

export function getCalendarColor(score: number | null): string {
  if (score === null) return CALENDAR_COLORS.none
  if (score <= 4)    return CALENDAR_COLORS.low
  if (score <= 6)    return CALENDAR_COLORS.mid
  if (score < 8)     return CALENDAR_COLORS.good
  return CALENDAR_COLORS.gold
}
