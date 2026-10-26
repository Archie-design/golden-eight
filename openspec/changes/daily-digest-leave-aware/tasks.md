# Tasks

## 1. 資料庫：新增 `is_leave` 欄位

- [x] 1.1 新增 migration `supabase/migrations/<today>_daily_status_leave.sql`：`ALTER TABLE daily_status_snapshot ADD COLUMN IF NOT EXISTS is_leave BOOLEAN NOT NULL DEFAULT FALSE` — `supabase/migrations/20261024_daily_status_leave.sql`
- [x] 1.2 更新 `supabase/schema.sql` 的 `daily_status_snapshot` 定義加上 `is_leave` 欄位（維持 schema.sql 作為 bootstrap 真相來源的慣例）
- [x] 1.3 於 Supabase SQL Editor 套用 migration（依專案既有流程），確認欄位已存在 — 使用者已於 Supabase SQL Editor 執行成功，已查證 `is_leave` 欄位可查詢且既有歷史列正確套用預設值 `false`

## 2. `lib/daily-status.ts`：DailyStatus 介面與 buildDailySnapshot

- [x] 2.1 `DailyStatus` 介面新增 `is_leave: boolean` 欄位
- [x] 2.2 `buildDailySnapshot()` 沿用現有 `leaveByMember?: Record<string, Set<string>>` 參數判斷當日是否請假（事由另由 `formatDigestMessage` 的獨立參數提供，見 4.3）
- [x] 2.3 判斷順序改為：請假 → `missed=false, miss_streak=延續前一日, is_leave=true`；有打卡 → `missed=false, miss_streak=0, is_leave=false`；都沒有 → `missed=true, miss_streak=前一日+1, is_leave=false`
- [x] 2.4 確認 `calcMonthStats` 呼叫（分母計算）維持不變，不受本次改動影響

## 3. `lib/daily-status.ts`：diffStatusEvents 排除請假日誤報回歸

- [x] 3.1 「回歸」事件（`return`）判定條件追加：`c.is_leave` 為假時才觸發（即使 `p.missed=true` 且 `c.missed=false`，若 `c.is_leave=true` 則不視為回歸）
- [x] 3.2 確認「開始缺卡」「跌破門檻」「回到門檻」「轉入長期缺席」事件判定不受影響（這些條件本身不涉及請假日的 `missed=false` 誤判情境）

## 4. `lib/daily-status.ts`：formatDigestMessage 新增請假名單

- [x] 4.1 新增 `onLeave = snapshot.filter(s => s.is_leave)` 區段
- [x] 4.2 在「❌ 漏卡」區塊之後插入「📝 今日請假 N 人」區塊，列出姓名＋事由；比照既有漏卡/長期缺席區塊的呈現風格 — 無人請假時整段不顯示（而非顯示空的「（無）」）
- [x] 4.3 事由取得：函式簽章新增一個參數接收請假事由對照（例如 `leaveReasonByMember: Record<string, string>`，鍵為當日有請假者的 member_id），由呼叫端（`route.ts`）組好傳入
- [x] 4.4 確認「❌ 漏卡」區塊本身不需改動（`missed` 欄位已經正確排除請假者）

## 5. `app/api/cron/daily-digest/route.ts`：串接新邏輯

- [x] 5.1 確認 `fetchLeaveDates`／`fetchLeaveRecords` 呼叫提供 `buildDailySnapshot`、`formatDigestMessage` 所需的請假日集合與事由對照 — 改用 `fetchLeaveRecords`，自行派生出 `leaveByMember`（Set）與 `leaveReasonByMember`（當日事由）
- [x] 5.2 快照 upsert（`db.from('daily_status_snapshot').upsert(...)`）確認 `is_leave` 欄位隨 `snapshot` 物件一併寫入（`buildDailySnapshot` 回傳值已含該欄位，upsert 呼叫本身可能不需改動，僅需確認）— `{...s, date}` 展開已自動包含
- [x] 5.3 `npx tsc --noEmit` 通過

## 6. 驗證

- [x] 6.1 `npm run lint` 通過
- [x] 6.2 手動驗證（可用 `scripts/manual_leave.py` 或既有請假資料）：挑一位當日有請假紀錄的成員，確認其不出現在「❌ 漏卡」、出現在「📝 今日請假」且事由正確 — 以高珮綺實際請假資料（10/18–20「大堂課請假」）模擬跑過 `buildDailySnapshot`/`formatDigestMessage` 核心邏輯，正確排除漏卡、正確顯示請假名單與事由
- [x] 6.3 手動驗證 miss_streak 銜接：找一位（或模擬）請假前已在缺卡中的情境，確認請假日 `miss_streak` 不變、請假結束後若仍缺卡則從原數值繼續累進（可用 Supabase SQL Editor 直接查 `daily_status_snapshot` 比對）— 模擬三種情境（請假期間原地不動／缺卡中請假不誤報回歸／請假後從原數值繼續累進並正確觸發 miss_start）皆驗證通過
- [x] 6.4 手動驗證無人請假的日子，摘要訊息格式與改動前一致（不多出空的請假區塊，或依設計顯示「（無）」，視任務 4.2 實作而定）— 已驗證：無人請假時「📝 今日請假」區塊完全不顯示
- [ ] 6.5 若方便，手動觸發一次 `/api/cron/daily-digest`（帶正確 `CRON_SECRET`）確認實際推播訊息格式正確，且同日重跑不重複推播（冪等性不受影響）— **待明天 12:30 cron 自然觸發後，使用者檢查實際推播訊息格式**
