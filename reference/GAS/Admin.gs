// ============================================================
// Admin.gs — 管理員專用 API
// ============================================================

/**
 * 取得所有成員（管理員）
 * @param {string} token
 */
function adminGetMembers(token) {
  const caller = authGetCurrentUser(token);
  if (!caller || !caller.isAdmin) return { ok: false, msg: '無管理員權限' };
  return { ok: true, members: dbGetAllMembers() };
}

/**
 * 新增 / 更新成員（管理員）
 * @param {string} token
 * @param {object} data
 */
function adminSaveMember(token, data) {
  const caller = authGetCurrentUser(token);
  if (!caller || !caller.isAdmin) return { ok: false, msg: '無管理員權限' };

  if (data.id) {
    dbUpdateMemberNextLevel(data.id, data.nextLevel || '');
    dbUpdateMemberStatus(data.id, data.status || '活躍');
    return { ok: true, msg: '成員資料已更新' };
  }

  const { name, phoneLast3, joinDate, level } = data;
  if (!name || !phoneLast3 || !level) return { ok: false, msg: '請填寫完整資料' };
  if (dbGetMemberByName(name)) return { ok: false, msg: '此姓名已存在' };

  const hash = hashPhone_(phoneLast3);
  const id   = dbCreateMember(name, hash, joinDate || getTodayStr_(), level);
  return { ok: true, msg: '成員已新增', id };
}

/**
 * 停用成員（管理員）
 * @param {string} token
 * @param {string} memberId
 */
function adminDisableMember(token, memberId) {
  const caller = authGetCurrentUser(token);
  if (!caller || !caller.isAdmin) return { ok: false, msg: '無管理員權限' };
  if (memberId === caller.id) return { ok: false, msg: '不能停用自己的帳號' };
  dbUpdateMemberStatus(memberId, '退出');
  return { ok: true, msg: '已停用' };
}

/**
 * 觸發月結算（管理員）
 * @param {string} token
 * @param {string} yearMonth
 */
function adminRunSettlement(token, yearMonth) {
  return statsRunMonthlySettlement(token, yearMonth || getYearMonth_());
}

/**
 * 取得成就排行榜
 * @param {string} token
 */
function adminGetAchievementRanking(token) {
  const caller = authGetCurrentUser(token);
  if (!caller || !caller.isAdmin) return { ok: false, msg: '無管理員權限' };

  const members = dbGetAllMembers();
  const ranking = members.map(m => {
    const ach = dbGetAchievements(m.id);
    return { name: m.name, id: m.id, count: ach.length, achievements: ach };
  }).sort((a, b) => b.count - a.count);

  return { ok: true, ranking };
}
