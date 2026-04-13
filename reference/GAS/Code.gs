// ============================================================
// Code.gs — doGet() 路由、頁面分發、全域初始化
// ============================================================

/**
 * 主入口：SPA 架構，永遠回傳 app.html
 * 登入狀態與頁面切換由前端 JS 控制
 */
function doGet(e) {
  // 每月 1 日檢查並套用下月階梯（已登入時）
  const user = authGetCurrentUser();
  if (user) {
    const today = getTodayStr_();
    if (today.endsWith('-01')) {
      dbApplyNextMonthLevel(user.id);
    }
  }
  return buildPage_('app');
}

function buildPage_(pageName) {
  try {
    const template = HtmlService.createTemplateFromFile(pageName);
    const output = template.evaluate()
      .setTitle('黃金八套餐定課系統')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return output;
  } catch (err) {
    return HtmlService.createHtmlOutput('<p>頁面不存在：' + pageName + '</p>');
  }
}

/**
 * GAS HTML 模板 include 輔助函式
 * 用法：<?= include('_style') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ─── 全域工具函式（供其他 .gs 使用）────────────────────────────

function getTodayStr_() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
}

function getNowTaipei_() {
  // 直接回傳 Date 物件；呼叫端改用 getNowHourTaipei_() 取台灣小時
  return new Date();
}

function getNowHourTaipei_() {
  return parseInt(Utilities.formatDate(new Date(), 'Asia/Taipei', 'H'), 10);
}

function getYearMonth_() {
  return getTodayStr_().substring(0, 7);
}

/**
 * 系統初始化（首次部署時手動執行一次）
 */
function initSystem() {
  dbInitSystemTagsIfNeeded();
  // 確認各 Sheet 有標題列
  const sheetsConfig = [
    { name: SHEET.MEMBERS,           headers: ['會員ID','姓名','電話末三碼雜湊','加入日期','挑戰階梯','下月預選階梯','地區','狀態','是否管理員'] },
    { name: SHEET.CHECKIN,           headers: ['記錄ID','日期','會員ID','任務1','任務2','任務3','任務4','任務5','任務6','任務7','任務8','基礎得分','打拳連續加分','當日總分','連續打拳天數','提交時間','備註'] },
    { name: SHEET.MONTHLY_SUMMARY,   headers: ['年月','會員ID','姓名','挑戰階梯','有效天數','基礎滿分','總得分','達成率','通過','罰款金額','連續打拳最長天數','結算狀態'] },
    { name: SHEET.ACHIEVEMENTS,      headers: ['紀錄ID','會員ID','成就代碼','成就名稱','達成日期','徽章圖示'] },
    { name: SHEET.SCHEDULE_TEMPLATE, headers: ['EntryID','MemberID','TagID','TagName','StartTime','EndTime','Note','IsPublic','UpdatedAt'] }
  ];
  sheetsConfig.forEach(cfg => {
    const sheet = getSheet_(cfg.name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(cfg.headers);
    }
  });
  return '初始化完成';
}
