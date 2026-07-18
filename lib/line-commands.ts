// ============================================================
// 黃金八套餐 — LINE bot 指令解析與回覆組裝（純函式）
// ============================================================
//
// 本檔僅做「文字 → 指令」解析與「資料 → 回覆文字」組裝，不碰 DB / fetch。
// DB 查詢與 LINE reply 留在 app/api/line/webhook/route.ts，便於單元測試與推理。
//
// 隱私原則：個人資料（我的狀態 / 今日）僅私訊回覆；公開資料（排行榜 / 破曉王 /
// 幫助）任一來源皆可。分流以事件 source.type 為唯一依據。

import { TASKS } from './constants'

export type CommandKind =
  | 'my_status'
  | 'today'
  | 'leaderboard'
  | 'dawn_king'
  | 'help'
  | 'menu'
  | null

/** LINE 事件來源型別 */
export type LineSourceType = 'user' | 'group' | 'room'

// ─── 指令解析 ──────────────────────────────────────────────────

// 別名 → 指令。key 為正規化後（去空白、去頭尾標點、小寫）的比對字串。
const COMMAND_ALIASES: Record<string, Exclude<CommandKind, null>> = {
  '我的狀態': 'my_status',
  '狀態':     'my_status',
  '我的進度': 'my_status',
  '進度':     'my_status',
  '今日':     'today',
  '今天':     'today',
  '今日打卡': 'today',
  '排行榜':   'leaderboard',
  '排名':     'leaderboard',
  '排行':     'leaderboard',
  '破曉王':   'dawn_king',
  '幫助':     'help',
  '說明':     'help',
  'help':     'help',
  '?':        'help',
  '？':       'help',
  '選單':     'menu',
  '主選單':   'menu',
  '開始':     'menu',
  'menu':     'menu',
}

/**
 * 將輸入文字正規化後對應到指令。
 * 正規化：去前後空白、去頭尾標點/空白、英文轉小寫。
 * 對應不到任何已支援指令 → 回 null（呼叫端應靜默略過，不回覆，避免洗版群組）。
 */
export function parseCommand(text: string): CommandKind {
  if (typeof text !== 'string') return null
  // 去頭尾空白與常見標點（保留 ? ／ ？ 因其本身是 help 別名）
  const trimmed = text.trim().replace(/^[\s、。，,.!！]+|[\s、。，,.!！]+$/g, '')
  const normalized = trimmed.toLowerCase()
  return COMMAND_ALIASES[normalized] ?? null
}

/** 該指令是否為公開資料（可於群組回覆）。null 視為非公開。 */
export function isPublicCommand(kind: CommandKind): boolean {
  return kind === 'leaderboard' || kind === 'dawn_king' || kind === 'help' || kind === 'menu'
  // menu：歡迎卡本身公開；卡片內的「個人統計」postback 自帶隱私分流。
}

// ─── 回覆文字組裝 ──────────────────────────────────────────────

export interface MyStatusData {
  name:       string
  level:      string
  rate:       number    // 0–100
  passing:    boolean
  penalty:    number    // NT$，達標為 0
  remaining:  number    // 距目標尚差的分數（maxScore*threshold - totalScore）
  exempted:   boolean   // 本月新進不計分
}

/** 「我的狀態」回覆。豁免成員回固定文案，不顯示 0% / 罰金。 */
export function formatMyStatus(d: MyStatusData): string {
  if (d.exempted) {
    return `${d.name} 本月新進，不參與計分 🌱\n下個月開始正式計分，先熟悉打卡節奏吧！`
  }
  const lines = [
    `📊 ${d.name} 本月狀態`,
    `階級：${d.level}`,
    `完成率：${d.rate}%`,
    d.passing
      ? '達標：✅ 已達標，本月免罰'
      : `達標：⚠️ 尚未達標，預估罰金 NT$${d.penalty}`,
  ]
  if (!d.passing && d.remaining > 0) {
    lines.push(`還差 ${d.remaining} 分達標，加油！`)
  }
  return lines.join('\n')
}

/**
 * 「今日」回覆。tasks 為當前邏輯日該成員 8 項打卡布林；null = 今日尚未打卡。
 */
export function formatToday(tasks: boolean[] | null): string {
  if (!tasks) {
    return '📝 今日尚未打卡\n記得完成 8 項任務並打卡喔！'
  }
  const lines = ['✅ 今日打卡狀態']
  const undone: string[] = []
  TASKS.forEach((t, i) => {
    const done = tasks[i] === true
    lines.push(`${done ? '✅' : '⬜'} ${t.name}`)
    if (!done) undone.push(t.name)
  })
  if (undone.length === 0) {
    lines.push('\n🎉 8 項全部完成，太強了！')
  } else {
    lines.push(`\n還沒完成：${undone.join('、')}`)
  }
  return lines.join('\n')
}

export interface LeaderboardRow {
  name: string
  rate: number   // 0–100
}

/** 「排行榜」回覆。rows 應已由呼叫端依 rate 降序排好。 */
export function formatLeaderboard(rows: LeaderboardRow[], topN = 5): string {
  if (rows.length === 0) return '本月尚無排行資料'
  const medals = ['🥇', '🥈', '🥉']
  const lines = ['🏆 本月完成率排行榜']
  rows.slice(0, topN).forEach((r, i) => {
    const mark = medals[i] ?? `${i + 1}.`
    lines.push(`${mark} ${r.name}　${r.rate}%`)
  })
  return lines.join('\n')
}

/** 「破曉王」回覆。candidates 為目前符合條件的成員名稱。 */
export function formatDawnKing(candidates: string[]): string {
  if (candidates.length === 0) {
    return '🌅 目前尚無破曉王候選\n（需本月每天不缺卡且每天完成破曉打拳）'
  }
  const lines = ['🌅 目前破曉王候選', ...candidates.map(n => `・${n}`)]
  return lines.join('\n')
}

/** 「幫助」回覆。依來源標示哪些指令僅限私訊。 */
export function formatHelp(sourceType: LineSourceType): string {
  const isPrivate = sourceType === 'user'
  const lines = [
    '🤖 可用指令',
    '',
    '【公開・群組也能查】',
    '・排行榜　→ 本月完成率前幾名',
    '・破曉王　→ 目前破曉王候選',
    '・幫助　　→ 顯示這份說明',
    '',
    '【個人・請私訊我查詢】',
    '・我的狀態　→ 本月完成率、階級、預估罰金',
    '・今日　　　→ 今天 8 項打卡狀態',
  ]
  if (!isPrivate) {
    lines.push('', '💡 個人資料為保護隱私，請點我頭像私訊查詢。')
  }
  return lines.join('\n')
}

/** 未綁定 LINE 的引導。bindUrl 由呼叫端依站台網址組出。 */
export function formatBindGuide(bindUrl: string): string {
  return [
    '🔗 尚未綁定 LINE 帳號',
    '綁定後即可用 LINE 查詢個人資料。',
    '',
    `請登入系統並綁定 LINE：\n${bindUrl}`,
  ].join('\n')
}

/** 群組查個人指令時的導向文案（不含任何個人數字）。 */
export function formatGroupPrivacyRedirect(): string {
  return '🔒 個人資料為保護隱私，請點我頭像私訊查詢「我的狀態」或「今日」。'
}
