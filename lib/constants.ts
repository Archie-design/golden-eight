// ============================================================
// 黃金八套餐 — 系統常數
// ============================================================

export const TASKS = [
  { name: '早睡早起',        icon: 'Moon',      image: '/icons/tasks/task-1.jpg', desc: '11 點前入睡，7 點前起床' },
  { name: '破曉打拳',        icon: 'Dumbbell',  image: '/icons/tasks/task-2.jpg', desc: '日出後 10 分鐘內完成' },
  { name: '丹氣跑步 15 分鐘', icon: 'Activity', image: '/icons/tasks/task-3.jpg', desc: '雨天可室內跑步' },
  { name: '曬太陽',           icon: 'Sun',       image: '/icons/tasks/task-4.jpg', desc: '陰雨天不計分' },
  { name: '工作 8 小時',     icon: 'Briefcase', image: '/icons/tasks/task-5.jpg', desc: '請依實際工時填寫，包括假日有工作也應填寫相應時數' },
  { name: '不吃肉',           icon: 'Leaf',      image: '/icons/tasks/task-6.jpg', desc: '各素食級別皆可' },
  { name: '寫觀心書',         icon: 'BookOpen',  image: '/icons/tasks/task-7.jpg', desc: '一階可寫覺察日記' },
  { name: '淨心功法',         icon: 'Wind',      image: '/icons/tasks/task-8.jpg', desc: '睡前效果更好' },
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

/**
 * 工時補扣機制起算日。早於此日的日期不納入計算（避免歷史月份缺工時資料造成誤扣）。
 * 4 月只計 4/29–4/30；5 月起整月正常計算。
 */
export const WORK_HOURS_TRACKING_START = '2026-04-29'

export const ACHIEVEMENT_LIST = [
  // 各任務連續天數（8 項 × 4 里程碑 = 32 個）
  { code: 'T1_STREAK_3',   name: '早鳥初心',    badge: 'Moon',       type: 'streak', task: 0, days: 3,   description: '連續 3 天完成「早睡早起」'        },
  { code: 'T1_STREAK_7',   name: '早鳥習慣',    badge: 'Sunrise',    type: 'streak', task: 0, days: 7,   description: '連續 7 天完成「早睡早起」'        },
  { code: 'T1_STREAK_30',  name: '早鳥達人',    badge: 'Coffee',     type: 'streak', task: 0, days: 30,  description: '連續 30 天完成「早睡早起」'       },
  { code: 'T1_STREAK_100', name: '早鳥百日',    badge: 'Crown',      type: 'streak', task: 0, days: 100, description: '連續 100 天完成「早睡早起」'      },
  { code: 'T2_STREAK_3',   name: '破曉初煉',    badge: 'Dumbbell',   type: 'streak', task: 1, days: 3,   description: '連續 3 天完成「破曉打拳」'        },
  { code: 'T2_STREAK_7',   name: '破曉星火',    badge: 'Zap',        type: 'streak', task: 1, days: 7,   description: '連續 7 天完成「破曉打拳」'        },
  { code: 'T2_STREAK_30',  name: '破曉月將',    badge: 'Shield',     type: 'streak', task: 1, days: 30,  description: '連續 30 天完成「破曉打拳」'       },
  { code: 'T2_STREAK_100', name: '破曉百日俠',  badge: 'Rocket',     type: 'streak', task: 1, days: 100, description: '連續 100 天完成「破曉打拳」'      },
  { code: 'T3_STREAK_3',   name: '跑步初動',    badge: 'Activity',   type: 'streak', task: 2, days: 3,   description: '連續 3 天完成「丹氣跑步 15 分鐘」'},
  { code: 'T3_STREAK_7',   name: '跑步習慣',    badge: 'TrendingUp', type: 'streak', task: 2, days: 7,   description: '連續 7 天完成「丹氣跑步 15 分鐘」'},
  { code: 'T3_STREAK_30',  name: '跑步達人',    badge: 'Target',     type: 'streak', task: 2, days: 30,  description: '連續 30 天完成「丹氣跑步 15 分鐘」'},
  { code: 'T3_STREAK_100', name: '百日跑者',    badge: 'Medal',      type: 'streak', task: 2, days: 100, description: '連續 100 天完成「丹氣跑步 15 分鐘」'},
  { code: 'T4_STREAK_3',   name: '初曬太陽',    badge: 'Sparkles',   type: 'streak', task: 3, days: 3,   description: '連續 3 天完成「曬太陽」'          },
  { code: 'T4_STREAK_7',   name: '陽光習慣',    badge: 'Sun',        type: 'streak', task: 3, days: 7,   description: '連續 7 天完成「曬太陽」'          },
  { code: 'T4_STREAK_30',  name: '陽光達人',    badge: 'Flame',      type: 'streak', task: 3, days: 30,  description: '連續 30 天完成「曬太陽」'         },
  { code: 'T4_STREAK_100', name: '百日暖陽',    badge: 'Award',      type: 'streak', task: 3, days: 100, description: '連續 100 天完成「曬太陽」'        },
  { code: 'T5_STREAK_3',   name: '勤奮初心',    badge: 'Briefcase',  type: 'streak', task: 4, days: 3,   description: '連續 3 天完成「工作 8 小時」'     },
  { code: 'T5_STREAK_7',   name: '勤奮習慣',    badge: 'Clock',      type: 'streak', task: 4, days: 7,   description: '連續 7 天完成「工作 8 小時」'     },
  { code: 'T5_STREAK_30',  name: '職人達人',    badge: 'BarChart3',  type: 'streak', task: 4, days: 30,  description: '連續 30 天完成「工作 8 小時」'    },
  { code: 'T5_STREAK_100', name: '職人百日',    badge: 'Gem',        type: 'streak', task: 4, days: 100, description: '連續 100 天完成「工作 8 小時」'   },
  { code: 'T6_STREAK_3',   name: '素心初願',    badge: 'Leaf',       type: 'streak', task: 5, days: 3,   description: '連續 3 天完成「不吃肉」'          },
  { code: 'T6_STREAK_7',   name: '素心習慣',    badge: 'Sprout',     type: 'streak', task: 5, days: 7,   description: '連續 7 天完成「不吃肉」'          },
  { code: 'T6_STREAK_30',  name: '素食達人',    badge: 'Heart',      type: 'streak', task: 5, days: 30,  description: '連續 30 天完成「不吃肉」'         },
  { code: 'T6_STREAK_100', name: '素食百日',    badge: 'Globe',      type: 'streak', task: 5, days: 100, description: '連續 100 天完成「不吃肉」'        },
  { code: 'T7_STREAK_3',   name: '觀心初啟',    badge: 'BookOpen',   type: 'streak', task: 6, days: 3,   description: '連續 3 天完成「寫觀心書」'        },
  { code: 'T7_STREAK_7',   name: '觀心習慣',    badge: 'Pencil',     type: 'streak', task: 6, days: 7,   description: '連續 7 天完成「寫觀心書」'        },
  { code: 'T7_STREAK_30',  name: '觀心達人',    badge: 'Brain',      type: 'streak', task: 6, days: 30,  description: '連續 30 天完成「寫觀心書」'       },
  { code: 'T7_STREAK_100', name: '觀心百日',    badge: 'Waves',      type: 'streak', task: 6, days: 100, description: '連續 100 天完成「寫觀心書」'      },
  { code: 'T8_STREAK_3',   name: '淨心初動',    badge: 'Wind',       type: 'streak', task: 7, days: 3,   description: '連續 3 天完成「淨心功法」'        },
  { code: 'T8_STREAK_7',   name: '淨心習慣',    badge: 'Feather',    type: 'streak', task: 7, days: 7,   description: '連續 7 天完成「淨心功法」'        },
  { code: 'T8_STREAK_30',  name: '淨心達人',    badge: 'CloudSun',   type: 'streak', task: 7, days: 30,  description: '連續 30 天完成「淨心功法」'       },
  { code: 'T8_STREAK_100', name: '淨心百日',    badge: 'Diamond',    type: 'streak', task: 7, days: 100, description: '連續 100 天完成「淨心功法」'      },
  // 單日特殊
  { code: 'FIRST_CHECKIN',       name: '萬里起行',   badge: 'PartyPopper',  type: 'first',                description: '完成首次打卡'                     },
  { code: 'DAILY_PERFECT',       name: '大滿貫',      badge: 'Star',         type: 'perfect',              description: '單日完成全部 8 項任務'            },
  // 累積里程碑
  { code: 'CHECKIN_30',  name: '打卡 30 天', badge: 'Calendar',      type: 'cumulative',    target: 30,  description: '累計打卡達 30 天'                 },
  { code: 'CHECKIN_100', name: '打卡百日',   badge: 'CalendarCheck', type: 'cumulative',    target: 100, description: '累計打卡達 100 天'                },
  { code: 'CHECKIN_365', name: '打卡一年',   badge: 'CalendarDays',  type: 'cumulative',    target: 365, description: '累計打卡達 365 天'                },
  { code: 'PERFECT_10',  name: '大滿貫 x10', badge: 'Ribbon',        type: 'perfect_count', target: 10,  description: '累計 10 次單日滿分（8 項全勾）'    },
  { code: 'PERFECT_30',  name: '大滿貫 x30', badge: 'Mountain',      type: 'perfect_count', target: 30,  description: '累計 30 次單日滿分'                },
  // 月度成就
  { code: 'MONTH_PASS',     name: '初次通關', badge: 'Unlock',        type: 'month_first',                description: '當月達成率達到所屬等級門檻'      },
  { code: 'MONTH_GOLD',     name: '黃金通關', badge: 'GraduationCap', type: 'month_gold',                 description: '以黃金戰士等級當月通關'          },
  { code: 'MONTH_PERFECT',  name: '完美月',   badge: 'CheckCircle2',  type: 'month_rate',    rate: 100,   description: '當月達成率達到 100%'             },
  { code: 'MONTH_STREAK_3', name: '三月連勝', badge: 'Swords',        type: 'month_streak',  n: 3,        description: '累計連續通關 3 個月'             },
  { code: 'MONTH_STREAK_6', name: '半年英雄', badge: 'Trophy',        type: 'month_streak',  n: 6,        description: '累計連續通關 6 個月'             },
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
