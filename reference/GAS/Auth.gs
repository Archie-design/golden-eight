// ============================================================
// Auth.gs — 登入驗證、會員註冊、Token Session 管理
// ============================================================
// Session 儲存於 ScriptProperties（key: 'sess_TOKEN'）
// 每個使用者有獨立 token，存於瀏覽器 localStorage
// ============================================================

const SESSION_PREFIX = 'sess_';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

/**
 * 產生 32 碼隨機 token
 */
function generateToken_() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < 32; i++) {
    t += chars[Math.floor(Math.random() * chars.length)];
  }
  return t;
}

/**
 * 將 token 寫入 ScriptProperties
 */
function createSession_(memberId) {
  const token   = generateToken_();
  const expires = new Date().getTime() + SESSION_TTL_MS;
  PropertiesService.getScriptProperties().setProperty(
    SESSION_PREFIX + token,
    JSON.stringify({ memberId, expires })
  );
  return token;
}

/**
 * 登入：驗證姓名 + 電話末三碼
 * @returns {{ ok, token, user, msg }}
 */
function authLogin(name, phoneLast3) {
  const hash   = hashPhone_(phoneLast3);
  const member = dbGetMemberByName(name);
  if (!member)                    return { ok: false, msg: '找不到此姓名，請確認或聯繫管理員' };
  if (member.status !== '活躍')   return { ok: false, msg: '帳號已停用，請聯繫管理員' };
  if (member.phoneHash !== hash)  return { ok: false, msg: '電話末三碼錯誤' };

  const token = createSession_(member.id);
  return { ok: true, token, user: sanitizeUser_(member) };
}

/**
 * 註冊新成員
 * @returns {{ ok, token, msg }}
 */
function authRegister(name, phoneLast3, joinDate, level) {
  const validLevels = ['黃金戰士', '白銀戰士', '青銅戰士'];
  if (!name || name.trim() === '')            return { ok: false, msg: '姓名不得為空' };
  if (!phoneLast3 || !/^\d{3}$/.test(phoneLast3)) return { ok: false, msg: '請輸入正確的電話末三碼' };
  if (!validLevels.includes(level))           return { ok: false, msg: '請選擇有效的挑戰階梯' };
  if (dbGetMemberByName(name))                return { ok: false, msg: '此姓名已被使用' };

  const hash     = hashPhone_(phoneLast3);
  const memberId = dbCreateMember(name.trim(), hash, joinDate || getTodayStr_(), level);

  const token = createSession_(memberId);
  return { ok: true, token, msg: '註冊成功！歡迎加入黃金八套餐' };
}

/**
 * 登出：刪除 ScriptProperties 中的 session
 * @param {string} token
 */
function authLogout(token) {
  if (token) {
    PropertiesService.getScriptProperties().deleteProperty(SESSION_PREFIX + token);
  }
  return { ok: true };
}

/**
 * 取得目前登入使用者（後端內部使用）
 * @param {string} token
 * @returns {object|null}
 */
function authGetCurrentUser(token) {
  if (!token) return null;
  const raw = PropertiesService.getScriptProperties().getProperty(SESSION_PREFIX + token);
  if (!raw) return null;
  try {
    const sess = JSON.parse(raw);
    // 檢查是否過期
    if (sess.expires && new Date().getTime() > sess.expires) {
      PropertiesService.getScriptProperties().deleteProperty(SESSION_PREFIX + token);
      return null;
    }
    return dbGetMemberById(sess.memberId);
  } catch (e) {
    return null;
  }
}

/**
 * 取得目前登入使用者（前端呼叫）
 * @param {string} token
 */
function authGetCurrentUserPublic(token) {
  const user = authGetCurrentUser(token);
  if (!user) return null;
  return sanitizeUser_(user);
}

/**
 * 更新下月挑戰階梯（25 日後才允許）
 * @param {string} token
 * @param {string} level
 */
function authUpdateNextMonthLevel(token, level) {
  const user = authGetCurrentUser(token);
  if (!user) return { ok: false, msg: '請先登入' };

  const today = getTodayStr_();
  const day   = parseInt(today.split('-')[2], 10);
  if (day < 25) return { ok: false, msg: '每月 25 日後才能選擇下月階梯' };

  const validLevels = ['黃金戰士', '白銀戰士', '青銅戰士'];
  if (!validLevels.includes(level)) return { ok: false, msg: '請選擇有效的挑戰階梯' };

  dbUpdateMemberNextLevel(user.id, level);
  return { ok: true, msg: '下月階梯已設定為：' + level };
}

/**
 * 清除所有過期 session（可定期手動執行）
 */
function authCleanExpiredSessions() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const now   = new Date().getTime();
  let count   = 0;
  Object.keys(props).forEach(key => {
    if (!key.startsWith(SESSION_PREFIX)) return;
    try {
      const sess = JSON.parse(props[key]);
      if (sess.expires && now > sess.expires) {
        PropertiesService.getScriptProperties().deleteProperty(key);
        count++;
      }
    } catch (e) {
      PropertiesService.getScriptProperties().deleteProperty(key);
      count++;
    }
  });
  return '已清除 ' + count + ' 個過期 session';
}

// ─── 內部工具 ──────────────────────────────────────────────────

function hashPhone_(phoneLast3) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, phoneLast3, Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function sanitizeUser_(member) {
  return {
    id: member.id, name: member.name, joinDate: member.joinDate,
    level: member.level, nextLevel: member.nextLevel,
    region: member.region, isAdmin: member.isAdmin
  };
}
