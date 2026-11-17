# Tasks

## 1. `lib/daily-status.ts`：重寫 `formatDigestMessage`

- [x] 1.1 改寫函式簽章：改為接收單一成員的具名參數（`today: { tasks: boolean[] | null; score: number | null; isLeave: boolean; leaveReason?: string }`、`monthStats: { totalScore, maxScore, rate, targetScore, remaining }`、`punchStreak: number`、`paceStatus: { pace, projRate, quadrant }`、`lastMonthRate: number | null`、`historicalAvgRate: number | null`、`date: string`），移除 `DailyStatus[]`/`events`/`membersById`/`recordsByMember` 等全員陣列參數
- [x] 1.2 移除漏卡名單、請假名單、門檻風險（四象限篩選）、長期缺席摺疊、「N 人完成·全月均」總結行的輸出邏輯
- [x] 1.3 新增輸出區塊：今日打卡狀況（8 項任務勾選 + 當日得分；未打卡顯示「今日未打卡」；請假顯示「今日已請假（事由）」）
- [x] 1.4 新增輸出區塊：本月累計（累計得分、達成率、距目標差）
- [x] 1.5 新增輸出區塊：連續打拳天數
- [x] 1.6 新增輸出區塊：今日 vs 上月同一天（`lastMonthRate` 為 `null` 時顯示「上月無資料」，不顯示 0%）
- [x] 1.7 新增輸出區塊：今日 vs 歷史累積平均（`historicalAvgRate` 為 `null` 時顯示「暫無歷史資料」）
- [x] 1.8 新增輸出區塊：追蹤軌道（直接顯示 `pace`/`projRate`，不篩選象限，單人情境下不論象限皆顯示）
- [x] 1.9 確認 `diffStatusEvents` 函式本身不刪除（保留供日後恢復多人模式參考），但 `formatDigestMessage` 不再呼叫其輸出 — 另順手移除了只為舊版渲染服務、現已無人呼叫的 `EVENT_LABEL` 常數與未用的 `calcPaceStatus` import（`diffStatusEvents`/`StatusEvent` 型別本身保留）

## 2. `app/api/cron/daily-digest/route.ts`：串接新資料

- [x] 2.1 新增查詢：上月同一天（依日序對齊，例如目標日為 11/16 則查上月第 16 天）的單筆 `checkin_records`（`total_score`），換算成達成率或 `null`
- [x] 2.2 新增查詢：柯啟鴻起算日到上月月底為止的歷史 `checkin_records`（`date, total_score`），加上回溯上限（比照 `app/api/stats/dashboard/route.ts` 的 `HISTORICAL_AVG_LOOKBACK_MONTHS = 12`，可抽成 `lib/scoring.ts` 或 `lib/constants.ts` 的共用常數，避免兩處各自定義一份魔術數字）— 已抽到 `lib/constants.ts`，兩處皆改為 import
- [x] 2.3 呼叫 `calcHistoricalAvgDailyRate`，從回傳陣列取出「目標日對應日序」的那一筆
- [x] 2.4 組出 `formatDigestMessage` 所需的新參數（`today`/`monthStats`/`punchStreak`/`paceStatus`/`lastMonthRate`/`historicalAvgRate`），呼叫既有 `calcMonthStats`/`calcPaceStatus`（沿用既有呼叫方式，不新增計算邏輯）
- [x] 2.5 移除不再需要的 `diffStatusEvents` 呼叫與其結果傳遞（若 `events` 變數不再被使用則一併移除）
- [x] 2.6 確認快照寫入（`buildDailySnapshot` + upsert）、冪等判斷（`pushed_at`）、推播對象（M001）、CRON_SECRET 驗證皆維持不變
- [x] 2.7 `npx tsc --noEmit` 通過

## 3. 驗證

- [x] 3.1 `npm run lint` 通過
- [x] 3.2 `npm run build`（webpack，避開已知 Turbopack 中文路徑 bug）確認可部署
- [x] 3.3 手動驗證：模擬或等待下次 12:30 cron 觸發，確認推播訊息包含今日打卡狀況、本月累計、連續打拳、上月同天對照、歷史累積平均對照、追蹤軌道，且不再出現漏卡名單/門檻風險/長期缺席摺疊等群組概念 — 以模擬腳本用真實 M001 資料驗證格式正確；**實際 12:30 cron 觸發的真實 LINE 推播待使用者於下次中午收到後確認**
- [x] 3.4 手動驗證今日未打卡情境：訊息明確標示「今日未打卡」 — 模擬腳本驗證通過
- [x] 3.5 手動驗證今日請假情境：訊息顯示「今日已請假（事由）」，不顯示為未打卡 — 模擬腳本驗證通過
- [x] 3.6 手動驗證無上月資料/無歷史資料時，對應區塊正確顯示「上月無資料」「暫無歷史資料」而非誤導性的 0% — 以模擬腳本（三情境：一般打卡日／今日未打卡／今日請假）驗證輸出格式時，發現請假/未打卡情境下比較區塊會顯示「今日 0%」（`today.score` 為 `null` 時誤算成 0），已修正為「今日尚無打卡紀錄，無法比較」
