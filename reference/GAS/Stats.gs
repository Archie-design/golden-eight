// ============================================================
// Stats.gs — 達成率計算、月結算、罰款判定、破曉王排名
// ============================================================

const LEVEL_THRESHOLD = { '黃金戰士': 0.80, '白銀戰士': 0.70, '青銅戰士': 0.60 };
const LEVEL_PENALTY   = { '黃金戰士': 200,  '白銀戰士': 300,  '青銅戰士': 400  };

/**
 * 取得個人儀表板資料
 * @param {string} token
 */
function statsGetDashboard(token) {
  const user = authGetCurrentUser(token);
  if (!user) return { ok: false, msg: '請先登入' };

  const today     = getTodayStr_();
  const yearMonth = today.substring(0, 7);
  const checkIns  = dbGetCheckInsByMonth(user.id, yearMonth);
  const allCIs    = dbGetCheckInsByMember(user.id);

  const calendar = buildCalendar_(yearMonth, checkIns);

  const taskCounts = Array(8).fill(0);
  checkIns.forEach(ci => ci.tasks.forEach((t, i) => { if (t) taskCounts[i]++; }));

  const joinDate   = new Date(user.joinDate + 'T00:00:00+08:00');
  const todayDate  = new Date(today + 'T00:00:00+08:00');
  const validDays  = Math.max(0, Math.floor((todayDate - joinDate) / 86400000));
  const maxScore   = validDays * 8;
  const totalScore = allCIs.reduce((s, ci) => {
    if (ci.date >= user.joinDate && ci.date < today) return s + (ci.totalScore || 0);
    return s;
  }, 0);
  const rate = maxScore > 0 ? Math.round(totalScore / maxScore * 100) : 0;

  const yesterday     = getDateStr_(addDays_(today, -1));
  const punchStreak   = calcCurrentStreak_(user.id, yesterday);
  const maxPunchMonth = calcMaxStreak_(checkIns.filter(ci => ci.tasks[1]));

  const threshold   = LEVEL_THRESHOLD[user.level] || 0.6;
  const targetScore = Math.ceil(maxScore * threshold);
  const remaining   = Math.max(0, targetScore - totalScore);

  const achievements = dbGetAchievements(user.id);

  const day = parseInt(today.split('-')[2], 10);
  const showNextLevelBtn = day >= 25;

  return {
    ok: true, user: { id: user.id, name: user.name, level: user.level, nextLevel: user.nextLevel },
    validDays, maxScore, totalScore, rate, targetScore, remaining,
    punchStreak, maxPunchMonth, taskCounts, calendar, achievements, showNextLevelBtn, yearMonth
  };
}

/**
 * 月結算（管理員觸發）
 * @param {string} token
 * @param {string} yearMonth
 */
function statsRunMonthlySettlement(token, yearMonth) {
  const caller = authGetCurrentUser(token);
  if (!caller || !caller.isAdmin) return { ok: false, msg: '無管理員權限' };

  const members = dbGetAllMembers().filter(m => m.status === '活躍');
  const results = [];
  let dawnKing  = null;
  let dawnMax   = -1;

  members.forEach(member => {
    const checkIns    = dbGetCheckInsByMonth(member.id, yearMonth);
    const joinDate    = new Date(member.joinDate + 'T00:00:00+08:00');
    const [yr, mo]    = yearMonth.split('-').map(Number);
    const lastDay     = new Date(yr, mo, 0);
    const firstDay    = new Date(yr, mo - 1, 1);
    const effectiveStart = joinDate > firstDay ? joinDate : firstDay;
    const validDays   = Math.max(0, Math.floor((lastDay - effectiveStart) / 86400000) + 1);
    const maxScore    = validDays * 8;
    const totalScore  = checkIns.reduce((s, ci) => s + (ci.totalScore || 0), 0);
    const rate        = maxScore > 0 ? totalScore / maxScore : 0;
    const threshold   = LEVEL_THRESHOLD[member.level] || 0.6;
    const pass        = rate >= threshold;
    const penalty     = pass ? 0 : (LEVEL_PENALTY[member.level] || 400);
    const punchCIs    = checkIns.filter(ci => ci.tasks[1]);
    const maxStreak   = calcMaxStreak_(punchCIs);

    if (maxStreak > dawnMax) { dawnMax = maxStreak; dawnKing = member.id; }

    dbSaveMonthlySummary({
      yearMonth, memberId: member.id, name: member.name, level: member.level,
      validDays, maxScore, totalScore, rate: Math.round(rate * 100),
      pass, penalty, maxStreak, status: '已結算'
    });

    achievementsCheckMonthly(member.id, yearMonth, pass, rate, member.level);
    results.push({ name: member.name, rate: Math.round(rate * 100), pass, penalty });
  });

  if (dawnKing) achievementsCheckDawnKing(dawnKing, yearMonth);

  return { ok: true, results, dawnKing };
}

/**
 * 取得全員本月進度（管理員）
 * @param {string} token
 */
function statsGetAllProgress(token) {
  const caller = authGetCurrentUser(token);
  if (!caller || !caller.isAdmin) return { ok: false, msg: '無管理員權限' };

  const today     = getTodayStr_();
  const yearMonth = today.substring(0, 7);
  const members   = dbGetAllMembers().filter(m => m.status === '活躍');

  const rows = members.map(member => {
    const checkIns   = dbGetCheckInsByMonth(member.id, yearMonth);
    const allCIs     = dbGetCheckInsByMember(member.id);
    const joinDate   = new Date(member.joinDate + 'T00:00:00+08:00');
    const todayDate  = new Date(today + 'T00:00:00+08:00');
    const validDays  = Math.max(0, Math.floor((todayDate - joinDate) / 86400000));
    const maxScore   = validDays * 8;
    const totalScore = allCIs.filter(ci => ci.date < today).reduce((s, ci) => s + (ci.totalScore || 0), 0);
    const rate       = maxScore > 0 ? Math.round(totalScore / maxScore * 100) : 0;
    const threshold  = LEVEL_THRESHOLD[member.level] || 0.6;
    const passing    = rate >= threshold * 100;
    const yesterday  = getDateStr_(addDays_(today, -1));
    const punchStreak = calcCurrentStreak_(member.id, yesterday);
    const maxStreak  = calcMaxStreak_(checkIns.filter(ci => ci.tasks[1]));

    return {
      id: member.id, name: member.name, level: member.level,
      totalScore, maxScore, rate, passing, punchStreak, maxStreak
    };
  });

  const maxS = Math.max(...rows.map(r => r.maxStreak), 0);
  if (maxS > 0) rows.forEach(r => { r.isDawnKing = r.maxStreak === maxS; });

  return { ok: true, rows, yearMonth };
}

/**
 * 取得罰款總結（管理員）
 * @param {string} token
 */
function statsGetPenaltySummary(token) {
  const caller = authGetCurrentUser(token);
  if (!caller || !caller.isAdmin) return { ok: false, msg: '無管理員權限' };

  const yearMonth = getYearMonth_();
  const rows  = dbGetAllMonthlySummary(yearMonth).filter(r => !r.pass);
  const total = rows.reduce((s, r) => s + (r.penalty || 0), 0);
  return { ok: true, rows, total, yearMonth };
}

// ─── 內部工具 ──────────────────────────────────────────────────

function buildCalendar_(yearMonth, checkIns) {
  const [yr, mo] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const ciMap = {};
  checkIns.forEach(ci => { ciMap[ci.date] = ci; });

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = yearMonth + '-' + String(d).padStart(2, '0');
    const ci = ciMap[dateStr];
    let color = 'gray';
    if (ci) {
      const s = ci.totalScore || 0;
      if (s >= 9) color = 'gold';
      else if (s >= 7) color = 'green';
      else if (s >= 5) color = 'orange';
      else color = 'red';
    }
    days.push({ date: dateStr, day: d, color, score: ci ? ci.totalScore : null });
  }
  return days;
}

function calcMaxStreak_(punchCIs) {
  if (!punchCIs.length) return 0;
  const sorted = punchCIs.map(ci => ci.date).sort();
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00+08:00');
    const curr = new Date(sorted[i]     + 'T00:00:00+08:00');
    const diff = Math.round((curr - prev) / 86400000);
    if (diff === 1) { cur++; max = Math.max(max, cur); }
    else cur = 1;
  }
  return max;
}
