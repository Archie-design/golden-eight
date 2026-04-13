// ============================================================
// Achievements.gs — 成就檢核、觸發、紀錄寫入
// ============================================================

// 所有成就定義
const ACHIEVEMENT_LIST = [
  // A — 連續類（8 項任務各 4 個）
  { code:'T1_STREAK_3',   name:'早鳥初心 🌅',   type:'streak', task:0, days:3   },
  { code:'T1_STREAK_7',   name:'早鳥習慣 🌅',   type:'streak', task:0, days:7   },
  { code:'T1_STREAK_30',  name:'早鳥達人 🌅',   type:'streak', task:0, days:30  },
  { code:'T1_STREAK_100', name:'早鳥百日 🌅',   type:'streak', task:0, days:100 },
  { code:'T2_STREAK_3',   name:'破曉初煉 🥊',   type:'streak', task:1, days:3   },
  { code:'T2_STREAK_7',   name:'破曉星火 🥊',   type:'streak', task:1, days:7   },
  { code:'T2_STREAK_30',  name:'破曉月將 🥊',   type:'streak', task:1, days:30  },
  { code:'T2_STREAK_100', name:'破曉百日俠 🥊', type:'streak', task:1, days:100 },
  { code:'T3_STREAK_3',   name:'跑步初動 🏃',   type:'streak', task:2, days:3   },
  { code:'T3_STREAK_7',   name:'跑步習慣 🏃',   type:'streak', task:2, days:7   },
  { code:'T3_STREAK_30',  name:'跑步達人 🏃',   type:'streak', task:2, days:30  },
  { code:'T3_STREAK_100', name:'百日跑者 🏃',   type:'streak', task:2, days:100 },
  { code:'T4_STREAK_3',   name:'初曬太陽 ☀️',  type:'streak', task:3, days:3   },
  { code:'T4_STREAK_7',   name:'陽光習慣 ☀️',  type:'streak', task:3, days:7   },
  { code:'T4_STREAK_30',  name:'陽光達人 ☀️',  type:'streak', task:3, days:30  },
  { code:'T4_STREAK_100', name:'百日暖陽 ☀️',  type:'streak', task:3, days:100 },
  { code:'T5_STREAK_3',   name:'勤奮初心 💼',   type:'streak', task:4, days:3   },
  { code:'T5_STREAK_7',   name:'勤奮習慣 💼',   type:'streak', task:4, days:7   },
  { code:'T5_STREAK_30',  name:'職人達人 💼',   type:'streak', task:4, days:30  },
  { code:'T5_STREAK_100', name:'職人百日 💼',   type:'streak', task:4, days:100 },
  { code:'T6_STREAK_3',   name:'素心初願 🥗',   type:'streak', task:5, days:3   },
  { code:'T6_STREAK_7',   name:'素心習慣 🥗',   type:'streak', task:5, days:7   },
  { code:'T6_STREAK_30',  name:'素食達人 🥗',   type:'streak', task:5, days:30  },
  { code:'T6_STREAK_100', name:'素食百日 🥗',   type:'streak', task:5, days:100 },
  { code:'T7_STREAK_3',   name:'觀心初啟 📖',   type:'streak', task:6, days:3   },
  { code:'T7_STREAK_7',   name:'觀心習慣 📖',   type:'streak', task:6, days:7   },
  { code:'T7_STREAK_30',  name:'觀心達人 📖',   type:'streak', task:6, days:30  },
  { code:'T7_STREAK_100', name:'觀心百日 📖',   type:'streak', task:6, days:100 },
  { code:'T8_STREAK_3',   name:'淨心初動 🧘',   type:'streak', task:7, days:3   },
  { code:'T8_STREAK_7',   name:'淨心習慣 🧘',   type:'streak', task:7, days:7   },
  { code:'T8_STREAK_30',  name:'淨心達人 🧘',   type:'streak', task:7, days:30  },
  { code:'T8_STREAK_100', name:'淨心百日 🧘',   type:'streak', task:7, days:100 },
  // B — 單日特殊類
  { code:'FIRST_CHECKIN',       name:'萬里起行 🎉',    type:'first'   },
  { code:'DAILY_PERFECT',       name:'大滿貫 🌟',      type:'perfect' },
  { code:'DAILY_PERFECT_BONUS', name:'金色大滿貫 ⭐',  type:'perfect_bonus' },
  // D — 累積里程碑
  { code:'CHECKIN_30',  name:'打卡 30 天 📅',  type:'cumulative', target:30  },
  { code:'CHECKIN_100', name:'打卡百日 📅',    type:'cumulative', target:100 },
  { code:'CHECKIN_365', name:'打卡一年 📅',    type:'cumulative', target:365 },
  { code:'PERFECT_10',  name:'大滿貫 x10 🌟', type:'perfect_count', target:10  },
  { code:'PERFECT_30',  name:'大滿貫 x30 🌟', type:'perfect_count', target:30  }
];

// 月度成就（由 Stats.gs 月結時呼叫）
const MONTHLY_ACHIEVEMENTS = [
  { code:'MONTH_PASS',     name:'初次通關 🎖️',  type:'month_first'         },
  { code:'MONTH_GOLD',     name:'黃金通關 🥇',  type:'month_gold'          },
  { code:'MONTH_PERFECT',  name:'完美月 💯',    type:'month_rate', rate:100 },
  { code:'MONTH_STREAK_3', name:'三月連勝 🔥',  type:'month_streak', n:3   },
  { code:'MONTH_STREAK_6', name:'半年英雄 🏆',  type:'month_streak', n:6   }
];

/**
 * 打卡後檢查成就（ConnectIn.gs 呼叫）
 * @returns {Array} 新解鎖成就列表
 */
function achievementsCheck(memberId, date) {
  const allCIs   = dbGetCheckInsByMember(memberId);
  const todayCI  = dbGetCheckIn(memberId, date);
  if (!todayCI) return [];

  const unlocked = dbGetAchievements(memberId).map(a => a.code);
  const newOnes  = [];

  function award(code, name, badge) {
    if (!unlocked.includes(code)) {
      dbSaveAchievement(memberId, code, name, date, badge);
      newOnes.push({ code, name, badge });
      unlocked.push(code);
    }
  }

  // 第一次打卡
  if (allCIs.length === 1) award('FIRST_CHECKIN', '萬里起行 🎉', '🎉');

  // 單日完美
  if (todayCI.baseScore === 8)      award('DAILY_PERFECT', '大滿貫 🌟', '🌟');
  if (todayCI.totalScore >= 9)      award('DAILY_PERFECT_BONUS', '金色大滿貫 ⭐', '⭐');

  // 累積打卡天數
  const ciCount = allCIs.length;
  [30, 100, 365].forEach((target, i) => {
    if (ciCount >= target) award(['CHECKIN_30','CHECKIN_100','CHECKIN_365'][i], ACHIEVEMENT_LIST.find(a => a.target === target && a.type === 'cumulative').name, '📅');
  });

  // 累積大滿貫次數
  const perfectCount = allCIs.filter(ci => ci.baseScore === 8).length;
  [10, 30].forEach((target, i) => {
    if (perfectCount >= target) award(['PERFECT_10','PERFECT_30'][i], ACHIEVEMENT_LIST.find(a => a.target === target && a.type === 'perfect_count').name, '🌟');
  });

  // 各任務連續天數
  const sortedCIs = allCIs.sort((a, b) => a.date.localeCompare(b.date));
  for (let taskIdx = 0; taskIdx < 8; taskIdx++) {
    const streak = calcTaskStreak_(sortedCIs, taskIdx, date);
    ACHIEVEMENT_LIST.filter(a => a.type === 'streak' && a.task === taskIdx).forEach(ach => {
      if (streak >= ach.days) award(ach.code, ach.name, ach.name.split(' ').pop());
    });
  }

  return newOnes;
}

/**
 * 月結後檢查月度成就（Stats.gs 呼叫）
 */
function achievementsCheckMonthly(memberId, yearMonth, pass, rate, level) {
  const unlocked = dbGetAchievements(memberId).map(a => a.code);
  const date = yearMonth + '-' + String(new Date(yearMonth.split('-')[0], yearMonth.split('-')[1], 0).getDate()).padStart(2, '0');

  function award(code, name, badge) {
    if (!unlocked.includes(code)) {
      dbSaveAchievement(memberId, code, name, date, badge);
      unlocked.push(code);
    }
  }

  if (!pass) return;
  if (!unlocked.includes('MONTH_PASS')) award('MONTH_PASS', '初次通關 🎖️', '🎖️');
  if (level === '黃金戰士')              award('MONTH_GOLD', '黃金通關 🥇', '🥇');
  if (rate >= 100)                       award('MONTH_PERFECT', '完美月 💯', '💯');

  // 連勝月數
  const allMonths = dbGetAchievements(memberId).filter(a => a.code === 'MONTH_PASS');
  const monthData = dbGetAllMonthlySummary ? [] : []; // 簡化：依 MONTH_PASS 計算
  const passCount = unlocked.filter(c => c === 'MONTH_PASS').length;
  if (passCount >= 3) award('MONTH_STREAK_3', '三月連勝 🔥', '🔥');
  if (passCount >= 6) award('MONTH_STREAK_6', '半年英雄 🏆', '🏆');
}

/**
 * 破曉王成就（Stats.gs 月結呼叫）
 */
function achievementsCheckDawnKing(memberId, yearMonth) {
  const date = yearMonth + '-' + String(new Date(yearMonth.split('-')[0], yearMonth.split('-')[1], 0).getDate()).padStart(2, '0');
  dbSaveAchievement(memberId, 'DAWN_KING_' + yearMonth, '破曉王 👑 (' + yearMonth + ')', date, '👑');
}

/**
 * 取得成員所有成就（前端）
 */
function achievementsGetAll() {
  const user = authGetCurrentUser();
  if (!user) return { ok: false, msg: '請先登入' };
  return { ok: true, achievements: dbGetAchievements(user.id), allList: ACHIEVEMENT_LIST };
}

// ─── 內部工具 ──────────────────────────────────────────────────

function calcTaskStreak_(sortedCIs, taskIdx, endDate) {
  // 從 endDate 往前算連續天數
  let streak = 0;
  let checkDate = endDate;
  for (let i = sortedCIs.length - 1; i >= 0; i--) {
    const ci = sortedCIs[i];
    if (ci.date !== checkDate) break;
    if (!ci.tasks[taskIdx]) break;
    streak++;
    const d = new Date(checkDate + 'T00:00:00+08:00');
    d.setDate(d.getDate() - 1);
    checkDate = Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  return streak;
}
