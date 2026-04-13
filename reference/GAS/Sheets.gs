// ============================================================
// Sheets.gs — 所有試算表 CRUD 操作集中管理
// ============================================================

const SPREADSHEET_ID = '1H9Rx-qRYbdDjMi45iyuPJxH31AbjSKYwRe_G1zpxUAc';

const SHEET = {
  MEMBERS:           'Members',
  CHECKIN:           'CheckIn',
  MONTHLY_SUMMARY:   'MonthlySummary',
  SUNRISE_TABLE:     'SunriseTable',
  ACHIEVEMENTS:      'Achievements',
  TAG_LIBRARY:       'TagLibrary',
  SCHEDULE_TEMPLATE: 'ScheduleTemplate'
};

// 欄位索引（0-based）
const COL = {
  MEMBERS: { ID:0, NAME:1, PHONE_HASH:2, JOIN_DATE:3, LEVEL:4, NEXT_LEVEL:5, REGION:6, STATUS:7, IS_ADMIN:8 },
  CHECKIN: { ID:0, DATE:1, MEMBER_ID:2, T1:3, T2:4, T3:5, T4:6, T5:7, T6:8, T7:9, T8:10,
             BASE_SCORE:11, PUNCH_BONUS:12, TOTAL_SCORE:13, PUNCH_STREAK:14, SUBMIT_TIME:15, NOTE:16 },
  MONTHLY_SUMMARY: { YEAR_MONTH:0, MEMBER_ID:1, NAME:2, LEVEL:3, VALID_DAYS:4,
                     MAX_SCORE:5, TOTAL_SCORE:6, RATE:7, PASS:8, PENALTY:9, MAX_STREAK:10, STATUS:11 },
  ACHIEVEMENTS: { ID:0, MEMBER_ID:1, CODE:2, NAME:3, DATE:4, BADGE:5 },
  TAG_LIBRARY:  { ID:0, MEMBER_ID:1, NAME:2, COLOR:3, EMOJI:4, IS_SYSTEM:5, CREATE_DATE:6 },
  SCHEDULE_TEMPLATE: { ID:0, MEMBER_ID:1, TAG_ID:2, TAG_NAME:3,
                       START_TIME:4, END_TIME:5, NOTE:6, IS_PUBLIC:7, UPDATED_AT:8 }
};

// ─── 取得 Sheet 工具 ──────────────────────────────────────────

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_(name) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function toDateStr_(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.substring(0, 10);
  return Utilities.formatDate(val, 'Asia/Taipei', 'yyyy-MM-dd');
}

function toBool_(val) {
  return val === true || val === 'TRUE' || val === 'true';
}

// ─── MEMBERS ─────────────────────────────────────────────────

function dbGetMemberById(memberId) {
  const rows = getSheet_(SHEET.MEMBERS).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.MEMBERS.ID] === memberId) return dbRowToMember_(rows[i]);
  }
  return null;
}

function dbGetMemberByName(name) {
  const rows = getSheet_(SHEET.MEMBERS).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.MEMBERS.NAME] === name) return dbRowToMember_(rows[i]);
  }
  return null;
}

function dbGetAllMembers() {
  const rows = getSheet_(SHEET.MEMBERS).getDataRange().getValues();
  return rows.slice(1).filter(r => r[COL.MEMBERS.ID]).map(dbRowToMember_);
}

function dbRowToMember_(row) {
  const c = COL.MEMBERS;
  return {
    id: row[c.ID], name: row[c.NAME], phoneHash: row[c.PHONE_HASH],
    joinDate: toDateStr_(row[c.JOIN_DATE]), level: row[c.LEVEL],
    nextLevel: row[c.NEXT_LEVEL], region: row[c.REGION],
    status: row[c.STATUS], isAdmin: toBool_(row[c.IS_ADMIN])
  };
}

function dbCreateMember(name, phoneHash, joinDate, level) {
  const sheet = getSheet_(SHEET.MEMBERS);
  // 若 sheet 還沒有任何列（initSystem 尚未執行），先建標題列
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['會員ID','姓名','電話末三碼雜湊','加入日期',
      '挑戰階梯','下月預選階梯','地區','狀態','是否管理員']);
  }
  const id = 'M' + String(sheet.getLastRow()).padStart(3, '0');
  sheet.appendRow([id, name, phoneHash, joinDate, level, '', '北部', '活躍', false]);
  return id;
}

function dbUpdateMemberNextLevel(memberId, nextLevel) {
  const sheet = getSheet_(SHEET.MEMBERS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.MEMBERS.ID] === memberId) {
      sheet.getRange(i + 1, COL.MEMBERS.NEXT_LEVEL + 1).setValue(nextLevel);
      return true;
    }
  }
  return false;
}

function dbApplyNextMonthLevel(memberId) {
  const sheet = getSheet_(SHEET.MEMBERS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.MEMBERS.ID] === memberId) {
      const next = rows[i][COL.MEMBERS.NEXT_LEVEL];
      if (next) {
        sheet.getRange(i + 1, COL.MEMBERS.LEVEL + 1).setValue(next);
        sheet.getRange(i + 1, COL.MEMBERS.NEXT_LEVEL + 1).setValue('');
      }
      return true;
    }
  }
  return false;
}

function dbUpdateMemberStatus(memberId, status) {
  const sheet = getSheet_(SHEET.MEMBERS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.MEMBERS.ID] === memberId) {
      sheet.getRange(i + 1, COL.MEMBERS.STATUS + 1).setValue(status);
      return true;
    }
  }
  return false;
}

// ─── CHECKIN ─────────────────────────────────────────────────

function dbGetCheckIn(memberId, dateStr) {
  const rows = getSheet_(SHEET.CHECKIN).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.CHECKIN.MEMBER_ID] === memberId &&
        toDateStr_(rows[i][COL.CHECKIN.DATE]) === dateStr) {
      return dbRowToCheckIn_(rows[i]);
    }
  }
  return null;
}

function dbGetCheckInsByMember(memberId) {
  const rows = getSheet_(SHEET.CHECKIN).getDataRange().getValues();
  return rows.slice(1)
    .filter(r => r[COL.CHECKIN.MEMBER_ID] === memberId)
    .map(dbRowToCheckIn_);
}

function dbGetCheckInsByMonth(memberId, yearMonth) {
  return dbGetCheckInsByMember(memberId).filter(ci => ci.date.startsWith(yearMonth));
}

function dbRowToCheckIn_(row) {
  const c = COL.CHECKIN;
  return {
    id: row[c.ID], date: toDateStr_(row[c.DATE]), memberId: row[c.MEMBER_ID],
    tasks: [row[c.T1], row[c.T2], row[c.T3], row[c.T4], row[c.T5], row[c.T6], row[c.T7], row[c.T8]],
    baseScore: row[c.BASE_SCORE], punchBonus: row[c.PUNCH_BONUS],
    totalScore: row[c.TOTAL_SCORE], punchStreak: row[c.PUNCH_STREAK],
    submitTime: row[c.SUBMIT_TIME], note: row[c.NOTE]
  };
}

function dbSaveCheckIn(record) {
  const sheet = getSheet_(SHEET.CHECKIN);
  const id = 'CI' + String(sheet.getLastRow()).padStart(4, '0');
  const c = COL.CHECKIN;
  const row = new Array(17).fill('');
  row[c.ID] = id;
  row[c.DATE] = record.date;
  row[c.MEMBER_ID] = record.memberId;
  for (let t = 0; t < 8; t++) row[c.T1 + t] = record.tasks[t];
  row[c.BASE_SCORE]   = record.baseScore;
  row[c.PUNCH_BONUS]  = record.punchBonus;
  row[c.TOTAL_SCORE]  = record.totalScore;
  row[c.PUNCH_STREAK] = record.punchStreak;
  row[c.SUBMIT_TIME]  = record.submitTime;
  row[c.NOTE]         = record.note || '';
  sheet.appendRow(row);
  return id;
}

// ─── MONTHLY SUMMARY ─────────────────────────────────────────

function dbGetMonthlySummary(memberId, yearMonth) {
  const rows = getSheet_(SHEET.MONTHLY_SUMMARY).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.MONTHLY_SUMMARY.MEMBER_ID] === memberId &&
        rows[i][COL.MONTHLY_SUMMARY.YEAR_MONTH] === yearMonth) {
      return dbRowToMonthlySummary_(rows[i]);
    }
  }
  return null;
}

function dbGetAllMonthlySummary(yearMonth) {
  const rows = getSheet_(SHEET.MONTHLY_SUMMARY).getDataRange().getValues();
  return rows.slice(1)
    .filter(r => r[COL.MONTHLY_SUMMARY.YEAR_MONTH] === yearMonth)
    .map(dbRowToMonthlySummary_);
}

function dbRowToMonthlySummary_(row) {
  const c = COL.MONTHLY_SUMMARY;
  return {
    yearMonth: row[c.YEAR_MONTH], memberId: row[c.MEMBER_ID], name: row[c.NAME],
    level: row[c.LEVEL], validDays: row[c.VALID_DAYS], maxScore: row[c.MAX_SCORE],
    totalScore: row[c.TOTAL_SCORE], rate: row[c.RATE],
    pass: toBool_(row[c.PASS]), penalty: row[c.PENALTY],
    maxStreak: row[c.MAX_STREAK], status: row[c.STATUS]
  };
}

function dbSaveMonthlySummary(data) {
  const sheet = getSheet_(SHEET.MONTHLY_SUMMARY);
  const rows = sheet.getDataRange().getValues();
  const rowData = [data.yearMonth, data.memberId, data.name, data.level,
    data.validDays, data.maxScore, data.totalScore, data.rate,
    data.pass, data.penalty, data.maxStreak, data.status];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.MONTHLY_SUMMARY.MEMBER_ID] === data.memberId &&
        rows[i][COL.MONTHLY_SUMMARY.YEAR_MONTH] === data.yearMonth) {
      sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      return;
    }
  }
  sheet.appendRow(rowData);
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────

function dbGetAchievements(memberId) {
  const rows = getSheet_(SHEET.ACHIEVEMENTS).getDataRange().getValues();
  return rows.slice(1)
    .filter(r => r[COL.ACHIEVEMENTS.MEMBER_ID] === memberId)
    .map(r => ({
      id: r[COL.ACHIEVEMENTS.ID], memberId: r[COL.ACHIEVEMENTS.MEMBER_ID],
      code: r[COL.ACHIEVEMENTS.CODE], name: r[COL.ACHIEVEMENTS.NAME],
      date: toDateStr_(r[COL.ACHIEVEMENTS.DATE]), badge: r[COL.ACHIEVEMENTS.BADGE]
    }));
}

function dbHasAchievement(memberId, code) {
  const rows = getSheet_(SHEET.ACHIEVEMENTS).getDataRange().getValues();
  return rows.slice(1).some(r =>
    r[COL.ACHIEVEMENTS.MEMBER_ID] === memberId && r[COL.ACHIEVEMENTS.CODE] === code);
}

function dbSaveAchievement(memberId, code, name, date, badge) {
  const sheet = getSheet_(SHEET.ACHIEVEMENTS);
  const id = 'A' + String(sheet.getLastRow()).padStart(4, '0');
  sheet.appendRow([id, memberId, code, name, date, badge]);
}

// ─── TAG LIBRARY ──────────────────────────────────────────────

function dbInitSystemTagsIfNeeded() {
  const sheet = getSheet_(SHEET.TAG_LIBRARY);
  if (sheet.getLastRow() > 1) return;
  const headers = ['TagID','MemberID','TagName','Color','Emoji','IsSystem','CreateDate'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const systemTags = [
    ['TSYS001','','早睡早起','#4CAF50','🌙',true],
    ['TSYS002','','破曉打拳','#FF5722','🥊',true],
    ['TSYS003','','丹氣跑步','#2196F3','🏃',true],
    ['TSYS004','','曬太陽',  '#FFC107','☀️',true],
    ['TSYS005','','工作8小時','#9C27B0','💼',true],
    ['TSYS006','','不吃肉',  '#8BC34A','🥗',true],
    ['TSYS007','','寫觀心書','#03A9F4','📖',true],
    ['TSYS008','','淨心功法','#E91E63','🧘',true],
    ['TSYS009','','起床',    '#FF9800','⏰',true],
    ['TSYS010','','刷牙洗臉','#00BCD4','🪥',true],
    ['TSYS011','','早餐',    '#CDDC39','🍳',true],
    ['TSYS012','','午餐',    '#FF7043','🍱',true],
    ['TSYS013','','晚餐',    '#795548','🍽️',true],
    ['TSYS014','','休息',    '#607D8B','😴',true]
  ];
  const now = new Date();
  const rows = systemTags.map(t => [...t, now]);
  sheet.getRange(2, 1, rows.length, 7).setValues(rows);
}

function dbGetTags(memberId) {
  dbInitSystemTagsIfNeeded();
  const rows = getSheet_(SHEET.TAG_LIBRARY).getDataRange().getValues();
  return rows.slice(1)
    .filter(r => toBool_(r[COL.TAG_LIBRARY.IS_SYSTEM]) || r[COL.TAG_LIBRARY.MEMBER_ID] === memberId)
    .map(dbRowToTag_);
}

function dbRowToTag_(row) {
  const c = COL.TAG_LIBRARY;
  return {
    id: row[c.ID], memberId: row[c.MEMBER_ID], name: row[c.NAME],
    color: row[c.COLOR], emoji: row[c.EMOJI],
    isSystem: toBool_(row[c.IS_SYSTEM]), createDate: toDateStr_(row[c.CREATE_DATE])
  };
}

function dbSaveTag(memberId, tagData) {
  const sheet = getSheet_(SHEET.TAG_LIBRARY);
  if (tagData.id) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][COL.TAG_LIBRARY.ID] === tagData.id &&
          rows[i][COL.TAG_LIBRARY.MEMBER_ID] === memberId) {
        sheet.getRange(i + 1, COL.TAG_LIBRARY.NAME + 1).setValue(tagData.name);
        sheet.getRange(i + 1, COL.TAG_LIBRARY.COLOR + 1).setValue(tagData.color);
        sheet.getRange(i + 1, COL.TAG_LIBRARY.EMOJI + 1).setValue(tagData.emoji || '');
        return tagData.id;
      }
    }
  }
  const id = 'TAG' + String(sheet.getLastRow()).padStart(3, '0');
  sheet.appendRow([id, memberId, tagData.name, tagData.color, tagData.emoji || '', false, new Date()]);
  return id;
}

function dbDeleteTag(memberId, tagId) {
  const sheet = getSheet_(SHEET.TAG_LIBRARY);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.TAG_LIBRARY.ID] === tagId) {
      if (toBool_(rows[i][COL.TAG_LIBRARY.IS_SYSTEM])) return { ok: false, msg: '系統標籤無法刪除' };
      if (rows[i][COL.TAG_LIBRARY.MEMBER_ID] !== memberId) return { ok: false, msg: '無權刪除他人標籤' };
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, msg: '標籤不存在' };
}

// ─── SCHEDULE TEMPLATE ───────────────────────────────────────

function dbGetSchedule(memberId) {
  const rows = getSheet_(SHEET.SCHEDULE_TEMPLATE).getDataRange().getValues();
  const entries = rows.slice(1)
    .filter(r => r[COL.SCHEDULE_TEMPLATE.MEMBER_ID] === memberId)
    .map(dbRowToScheduleEntry_);
  const isPublic = entries.length > 0 && toBool_(entries[0].isPublic);
  return { entries, isPublic };
}

function dbRowToScheduleEntry_(row) {
  const c = COL.SCHEDULE_TEMPLATE;
  return {
    id: row[c.ID], memberId: row[c.MEMBER_ID],
    tagId: row[c.TAG_ID], tagName: row[c.TAG_NAME],
    startTime: row[c.START_TIME], endTime: row[c.END_TIME],
    note: row[c.NOTE], isPublic: toBool_(row[c.IS_PUBLIC]),
    updatedAt: row[c.UPDATED_AT]
  };
}

function dbSaveScheduleTemplate(memberId, entries, isPublic) {
  const sheet = getSheet_(SHEET.SCHEDULE_TEMPLATE);
  // 刪除該成員所有舊條目（從後往前刪避免索引位移）
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][COL.SCHEDULE_TEMPLATE.MEMBER_ID] === memberId) sheet.deleteRow(i + 1);
  }
  // 寫入新條目
  const now = new Date();
  entries.forEach((entry, idx) => {
    const id = 'SE' + String(Date.now() + idx).slice(-6);
    sheet.appendRow([id, memberId, entry.tagId, entry.tagName,
      entry.startTime, entry.endTime, entry.note || '', isPublic, now]);
  });
}

function dbGetPublicSchedules() {
  const rows = getSheet_(SHEET.SCHEDULE_TEMPLATE).getDataRange().getValues();
  const members = dbGetAllMembers();
  const memberMap = {};
  members.forEach(m => (memberMap[m.id] = m.name));

  const byMember = {};
  rows.slice(1).forEach(row => {
    if (!toBool_(row[COL.SCHEDULE_TEMPLATE.IS_PUBLIC])) return;
    const mid = row[COL.SCHEDULE_TEMPLATE.MEMBER_ID];
    if (!byMember[mid]) byMember[mid] = [];
    byMember[mid].push(dbRowToScheduleEntry_(row));
  });

  return Object.keys(byMember).map(mid => ({
    memberId: mid,
    memberName: memberMap[mid] || mid,
    entries: byMember[mid].sort((a, b) => a.startTime.localeCompare(b.startTime))
  }));
}
