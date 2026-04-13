// ============================================================
// CheckIn.gs — 打卡提交、補報邏輯、連續打拳計算
// ============================================================

/**
 * 取得今日打卡頁面所需資料
 * @param {string} token
 */
function checkInGetTodayData(token) {
  const user = authGetCurrentUser(token);
  if (!user) return { ok: false, msg: '請先登入' };

  const today     = getTodayStr_();
  const yesterday = getDateStr_(new Date(new Date().getTime() - 86400000));
  const nowHour   = getNowHourTaipei_();
  const sunrise   = getSunriseTime(today);
  const deadline  = getPunchDeadline(today);
  const yearMonth = today.substring(0, 7);

  const todayRecord     = dbGetCheckIn(user.id, today);
  const yesterdayRecord = dbGetCheckIn(user.id, yesterday);
  const monthCheckIns   = dbGetCheckInsByMonth(user.id, yearMonth);
  const monthRate       = calcMonthRate_(user, monthCheckIns, today);
  const punchStreak     = todayRecord ? todayRecord.punchStreak : calcCurrentStreak_(user.id, yesterday);
  const canMakeup       = !yesterdayRecord && nowHour < 12;

  return {
    ok: true, today, sunrise, punchDeadline: deadline,
    punchStreak, monthRate,
    todayRecord: todayRecord
      ? { submitted: true, totalScore: todayRecord.totalScore, submitTime: todayRecord.submitTime }
      : { submitted: false },
    canMakeup, yesterday: canMakeup ? yesterday : null
  };
}

/**
 * 提交打卡
 * @param {string} token
 * @param {Object} data - { tasks:[0|1 x8], note, date(可選，補報用) }
 */
function checkInSubmit(token, data) {
  const user = authGetCurrentUser(token);
  if (!user) return { ok: false, msg: '請先登入' };

  const now     = new Date();
  const nowHour = getNowHourTaipei_();
  const today   = getTodayStr_();
  const target  = data.date || today;

  // 驗證日期合法性
  if (target !== today) {
    const yesterday = getDateStr_(new Date(now.getTime() - 86400000));
    if (target !== yesterday) return { ok: false, msg: '只能補報前一天的記錄' };
    if (nowHour >= 12)        return { ok: false, msg: '補報時間已截止（每日中午 12:00 前）' };
  }

  // 防重複提交
  if (dbGetCheckIn(user.id, target)) {
    return { ok: false, msg: `${target} 的打卡記錄已存在` };
  }

  // 驗證任務陣列
  const tasks = (data.tasks || []).map(t => (t ? 1 : 0));
  while (tasks.length < 8) tasks.push(0);

  // 計算分數
  const baseScore   = tasks.reduce((s, t) => s + t, 0);
  const punchBonus  = calcPunchBonus_(user.id, target, tasks[1]);
  const totalScore  = baseScore + punchBonus;
  const punchStreak = calcPunchStreak_(user.id, target, tasks[1]);

  const record = {
    memberId: user.id, date: target,
    tasks, baseScore, punchBonus, totalScore, punchStreak,
    submitTime: now, note: data.note || ''
  };

  dbSaveCheckIn(record);

  // 成就檢查
  const newAchievements = achievementsCheck(user.id, target);

  return { ok: true, msg: '打卡成功', totalScore, baseScore, punchBonus, punchStreak, newAchievements };
}

// ─── 內部計算 ──────────────────────────────────────────────────

function calcPunchBonus_(memberId, targetDate, todayPunch) {
  if (!todayPunch) return 0;
  const yesterday = getDateStr_(addDays_(targetDate, -1));
  const yrec = dbGetCheckIn(memberId, yesterday);
  return (yrec && yrec.tasks[1]) ? 1 : 0;
}

function calcPunchStreak_(memberId, targetDate, todayPunch) {
  if (!todayPunch) return 0;
  const yesterday = getDateStr_(addDays_(targetDate, -1));
  const yrec = dbGetCheckIn(memberId, yesterday);
  return yrec ? (yrec.punchStreak || 0) + 1 : 1;
}

function calcCurrentStreak_(memberId, asOfDate) {
  const rec = dbGetCheckIn(memberId, asOfDate);
  return rec ? (rec.punchStreak || 0) : 0;
}

function calcMonthRate_(user, monthCheckIns, today) {
  const joinDate   = new Date(user.joinDate + 'T00:00:00+08:00');
  const todayDate  = new Date(today + 'T00:00:00+08:00');
  const validDays  = Math.max(0, Math.floor((todayDate - joinDate) / 86400000));
  if (validDays === 0) return 0;
  const totalScore = monthCheckIns.reduce((s, ci) => s + (ci.totalScore || 0), 0);
  return Math.round(totalScore / (validDays * 8) * 100);
}

// ─── 日期工具 ──────────────────────────────────────────────────

function getDateStr_(date) {
  return Utilities.formatDate(date, 'Asia/Taipei', 'yyyy-MM-dd');
}

function addDays_(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  d.setDate(d.getDate() + days);
  return d;
}
