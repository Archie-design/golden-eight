# Proposal

## Why

每日 12:30 的 LINE 摘要（`/api/cron/daily-digest`）已經在達成率、門檻風險（`calcMonthStats`/`calcPaceStatus`）正確扣除請假天數，但「❌ 漏卡」名單的判定（`buildDailySnapshot()` 的 `hasToday = records.some(r => r.date === date)`）完全沒有檢查該成員當天是否請假——請假者沒有 `checkin_records`，會被直接當成漏卡，跟真正忘記打卡的人混在同一份名單，管理員無法從推播訊息分辨誰是真的需要關心、誰只是請假。

## What Changes

- `buildDailySnapshot()`：請假日 MUST NOT 被判定為 `missed`，比照 `calcMonthStats`/`calcPaceStatus` 已經採用的「請假日如同不存在」原則：
  - 請假當天：`missed = false`（不計入漏卡），`miss_streak` MUST NOT 累進（視為該日不存在，延續請假前的 `miss_streak` 數值，不歸零也不+1）。
  - `daily_status_snapshot` 新增一個欄位標記該日是否為請假（例如 `is_leave`），作為「當下事實快照」的一部分，與 `missed`/`rate`/`passing` 同樣寫入當下不可重算。
- `diffStatusEvents()`：請假日 MUST NOT 觸發 `miss_start`（開始缺卡）或 `return`（回歸）事件——請假前一天若已在缺卡中，請假當天不應誤報「回歸」；請假結束後第一個真正缺卡日才應正常觸發 `miss_start`。
- `formatDigestMessage()`：
  - 「❌ 漏卡」名單 SHALL 排除當日請假者。
  - 新增「📝 今日請假」區塊，列出當日請假成員與事由。
- 以上皆複用既有 `fetchLeaveDates`（`lib/leave.ts`），不新增查詢邏輯。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `daily-status-digest`: 「快照內容為當下事實且不可重算」需求擴充，新增請假標記欄位與 `miss_streak` 的請假日處理規則；「狀態變化事件判定」需求擴充，請假日不觸發 `miss_start`/`return`；「摘要內容與長期缺席摺疊」需求擴充，漏卡名單排除請假者、新增請假名單區塊。

## Impact

- **後端**：[lib/daily-status.ts](../../../lib/daily-status.ts)（`buildDailySnapshot`、`diffStatusEvents`、`formatDigestMessage` 三個函式皆需調整）；[app/api/cron/daily-digest/route.ts](../../../app/api/cron/daily-digest/route.ts)（已經有呼叫 `fetchLeaveDates`，只需確認傳遞方式與新欄位對齊）。
- **資料庫**：`daily_status_snapshot` 表新增一個欄位（例如 `is_leave BOOLEAN`），需要一筆 migration。
- **不影響**：`calcMonthStats`、`calcPaceStatus`、`expectedCheckinDays` 等既有分母計算函式不變（這些已經正確處理請假）；儀表板、管理後台等其他畫面不受影響（`daily-status.ts` 僅被 `daily-digest` cron 使用）。
- **回溯相容**：既有歷史 `daily_status_snapshot` 列沒有 `is_leave` 欄位，新欄位 MUST 有合理預設值（`false`），不影響歷史資料的既有語意（歷史上這個區分本來就不存在，不需要回填）。
