// ============================================================
// 黃金八套餐 — LINE Flex Message 組裝（歡迎卡）
// ============================================================
//
// 純函式：吃站台網址，吐 LINE Flex message 物件。無 DB / fetch。
// 風格參考「定課小幫手」的說明卡 + 三按鈕，但內容為黃金八套餐實際規則。
//
// 三按鈕：
//   🎯 參加定課 → URI，開網頁登入/註冊頁（siteUrl 根）
//   ✅ 完成定課 → URI，開網頁打卡頁（siteUrl/checkin）
//   📊 個人統計 → postback（action=my_stats），在 LINE 回「我的狀態」

import type { LineFlexMessage } from './line-push'
import { TASKS } from './constants'

/** 個人統計按鈕的 postback data；webhook 端以此字串分派。 */
export const POSTBACK_MY_STATS = 'action=my_stats'

/**
 * 組出歡迎卡（Flex bubble）。
 * @param siteUrl 站台根網址（如 https://golden-eight-set.vercel.app，無尾斜線）
 */
export function buildWelcomeFlex(siteUrl: string): LineFlexMessage {
  const root     = siteUrl.replace(/\/+$/, '')      // 去尾斜線
  const joinUri  = `${root}/`
  const doneUri  = `${root}/checkin`

  const taskList = TASKS.map((t, i) => `${i + 1}. ${t.name}`).join('　')

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: '👋 歡迎加入黃金八套餐', weight: 'bold', size: 'lg', wrap: true, color: '#B8860B' },
        { type: 'text', text: '每天完成 8 項任務、打卡累積點數，一起養成好習慣！', size: 'sm', color: '#666666', wrap: true },

        { type: 'separator', margin: 'md' },

        { type: 'text', text: '使用方式', weight: 'bold', size: 'sm', margin: 'md' },
        { type: 'text', text: '• 點「🎯 參加定課」完成註冊\n• 每天點「✅ 完成定課」記錄進度\n• 點「📊 個人統計」查看表現', size: 'sm', color: '#555555', wrap: true },

        { type: 'separator', margin: 'md' },

        { type: 'text', text: '每日 8 項任務', weight: 'bold', size: 'sm', margin: 'md' },
        { type: 'text', text: taskList, size: 'xs', color: '#555555', wrap: true },

        { type: 'text', text: '達標門檻與罰金', weight: 'bold', size: 'sm', margin: 'md' },
        { type: 'text', text: '🥇 黃金 ≥80%（未達罰 NT$200）\n🥈 白銀 ≥70%（未達罰 NT$300）\n🥉 青銅 ≥60%（未達罰 NT$400）', size: 'xs', color: '#555555', wrap: true },

        { type: 'text', text: '⏰ 每日 12:00（台北）前完成當日打卡\n📅 每月月結，未達標依階級計罰', size: 'xs', color: '#999999', wrap: true, margin: 'md' },

        { type: 'text', text: '💪 堅持就是勝利！', weight: 'bold', size: 'sm', align: 'center', margin: 'md', color: '#B8860B' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button', style: 'primary', color: '#C79A3B', height: 'sm',
          action: { type: 'uri', label: '🎯 參加定課', uri: joinUri },
        },
        {
          type: 'button', style: 'primary', color: '#5B8A51', height: 'sm',
          action: { type: 'uri', label: '✅ 完成定課', uri: doneUri },
        },
        {
          type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'postback', label: '📊 個人統計', data: POSTBACK_MY_STATS, displayText: '個人統計' },
        },
      ],
    },
  }

  return { type: 'flex', altText: '黃金八套餐 定課小幫手選單', contents: bubble }
}
