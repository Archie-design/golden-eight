# Proposal

## Why

請假紀錄（`leave_records`）目前只影響分母計算（達成率%），完全沒有反映在任何畫面上：打卡頁/儀表板的月曆、管理後台的個人逐日明細表，請假日都跟「未打卡/無記錄」顯示成一樣的灰色或「（無記錄）」。管理員或學員自己都無法回頭查「某一天到底是請假還是漏卡」，近期已發生需要靠直接查資料庫才能確認請假狀態的情況。更嚴重的是，管理後台的個人逐日明細表（`/api/admin/member-records` + `app/(main)/admin/page.tsx` 的累計率欄位）是前端自行以 `dates.length * 8` 當分母計算累計率，完全沒有扣除請假天數，與系統其餘所有「累計率」計算（`calcMonthStats`／`fetchLeaveDates`）的分母定義不一致，在請假日之後的累計率數字會偏低、跟儀表板看到的不同。

## What Changes

- `CalendarGrid`（打卡頁、儀表板月曆共用元件）：請假日 SHALL 有獨立的顏色樣式，不與「未報」灰色混用；沿用既有 hover/點擊顯示備註的互動模式，顯示請假事由。
- `GET /api/stats/dashboard` 的 `calendar[]`：每日物件 SHALL 新增請假標記（含事由），讓前端得以區分「未報」與「請假」。
- 管理後台個人逐日明細表（`/api/admin/member-records` + 對應頁面表格）：
  - 請假日的那一列 SHALL 明確標示為「請假」（含事由），取代目前的「（無記錄）」。
  - **BREAKING（行為修正，非 API 形狀破壞）**：累計率欄位的分母計算 SHALL 改為與系統其餘「累計率」口徑一致——扣除請假天數（沿用既有 `fetchLeaveDates`），而非目前前端寫死的 `dates.length * 8`。此為修正既有的分母不一致 bug，修正後此表累計率數字可能與修正前不同。
- 以上皆讀取既有 `leave_records` 表，透過既有 `fetchLeaveDates`（`lib/leave.ts`）取得請假日集合，不另建新的請假資料查詢邏輯，確保分母計算與畫面顯示的請假判定使用同一份真相來源。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `dashboard-stats`: 「月曆視圖」需求擴充，請假日需有獨立顯示樣式；「儀表板 API」回應的 `calendar[]` 新增請假標記欄位。
- `leave-request`: 新增「請假狀態的可見性」需求——請假狀態不應只影響分母計算，也必須能被使用者（學員自己、管理員）在既有畫面上查到，而非只能查資料庫。

## Impact

- **前端**：[components/CalendarGrid.tsx](../../../components/CalendarGrid.tsx)（新增請假樣式、hover/點擊顯示事由）；[app/(main)/admin/page.tsx](../../../app/(main)/admin/page.tsx)（個人逐日明細表的請假列顯示、累計率分母改為扣除請假天數）。
- **API**：[app/api/stats/dashboard/route.ts](../../../app/api/stats/dashboard/route.ts)（`calendar[]` 新增請假標記，已取得的 `leaveDates` 直接複用，不需新查詢）；[app/api/admin/member-records/route.ts](../../../app/api/admin/member-records/route.ts)（新增呼叫 `fetchLeaveDates` 並回傳請假日集合／事由，供前端計算正確累計率與顯示請假列）。
- **共用邏輯**：複用既有 [lib/leave.ts](../../../lib/leave.ts) 的 `fetchLeaveDates`，不新增查詢路徑。
- **不影響**：`leave_records` 資料表結構、既有請假 API（`POST`/`DELETE /api/checkin/leave`）的行為、`calcMonthStats`/`expectedCheckinDays` 等既有分母計算函式均不變——本次只修正「管理後台逐日明細表」這一處原本漏接 `fetchLeaveDates` 的分母計算，以及新增畫面顯示。
