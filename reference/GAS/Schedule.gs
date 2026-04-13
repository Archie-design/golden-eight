// ============================================================
// Schedule.gs — 行程模板：標籤庫管理、模板存取、公開分享
// ============================================================

/**
 * 取得行程頁面所需全部資料
 * @param {string} token
 */
function scheduleGetData(token) {
  const user = authGetCurrentUser(token);
  if (!user) return { ok: false, msg: '請先登入' };

  const tags     = dbGetTags(user.id);
  const schedule = dbGetSchedule(user.id);
  return { ok: true, user: { id: user.id, name: user.name }, tags, schedule };
}

/**
 * 新增或更新自訂標籤
 * @param {string} token
 * @param {{ id?, name, color, emoji }} tagData
 */
function scheduleSaveTag(token, tagData) {
  const user = authGetCurrentUser(token);
  if (!user) return { ok: false, msg: '請先登入' };
  if (!tagData.name || !tagData.name.trim()) return { ok: false, msg: '標籤名稱不得為空' };
  if (!tagData.color) return { ok: false, msg: '請選擇顏色' };

  tagData.name = tagData.name.trim().substring(0, 20);
  const id = dbSaveTag(user.id, tagData);
  return { ok: true, id, msg: '標籤已儲存' };
}

/**
 * 刪除自訂標籤
 * @param {string} token
 * @param {string} tagId
 */
function scheduleDeleteTag(token, tagId) {
  const user = authGetCurrentUser(token);
  if (!user) return { ok: false, msg: '請先登入' };
  return dbDeleteTag(user.id, tagId);
}

/**
 * 儲存整份行程模板
 * @param {string} token
 * @param {{ entries: Array, isPublic: boolean }} payload
 */
function scheduleSaveTemplate(token, payload) {
  const user = authGetCurrentUser(token);
  if (!user) return { ok: false, msg: '請先登入' };

  const { entries = [], isPublic = false } = payload;

  for (const entry of entries) {
    if (!entry.startTime || !entry.endTime)
      return { ok: false, msg: '每個行程都必須有起訖時間' };
    if (entry.startTime >= entry.endTime)
      return { ok: false, msg: `時間設定錯誤：${entry.tagName} 的結束時間必須晚於開始時間` };
  }

  dbSaveScheduleTemplate(user.id, entries, isPublic);
  return { ok: true, msg: '行程模板已儲存' };
}

/**
 * 取得所有公開行程（群組瀏覽）
 * @param {string} token
 */
function scheduleGetPublic(token) {
  const user = authGetCurrentUser(token);
  if (!user) return { ok: false, msg: '請先登入' };
  return { ok: true, schedules: dbGetPublicSchedules() };
}
