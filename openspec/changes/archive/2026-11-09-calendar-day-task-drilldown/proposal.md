# Proposal

## Why

儀表板「本月打卡月曆」目前每格只上色顯示當日總分，學員想知道「那天到底打了哪些項目」只能回想或重新打開當天的打卡頁，無法直接在月曆上查看。既有的「點擊展開備註面板」互動（目前僅在有備註或請假事由的日子才可點擊）是現成的呼現機制，適合擴充成顯示當日 8 項任務的完成狀態。

## What Changes

- 月曆每一格 SHALL 可點擊（不再限於有備註/請假事由的日子），點擊後展開的面板新增 8 項任務的完成狀態（比照既有顏色/圖示語彙：完成/未完成），備註與請假事由維持原有顯示位置。
- 未打卡（`score = null`）且無請假的日子點擊後 SHALL 顯示「當日未打卡」提示，不顯示空的 8 項任務勾選（避免呈現「全部未完成」造成誤解，當日根本沒有紀錄）。
- `GET /api/stats/dashboard` 的 `calendar[]` 每日物件 SHALL 新增 `tasks: boolean[8] | null` 欄位（當日無打卡紀錄時為 `null`），供面板渲染用。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `dashboard-stats`: 「儀表板 API」需求的 `calendar[]` 新增 `tasks` 欄位；「月曆視圖」需求擴充為任一日期皆可點擊展開查看當日 8 項任務完成狀態。

## Impact

- **後端**：[app/api/stats/dashboard/route.ts](../../../app/api/stats/dashboard/route.ts)（`calendar[]` 組裝邏輯新增 `tasks` 欄位，資料已經在 `monthRecs` 查詢結果中，不需新增查詢）。
- **前端**：[components/CalendarGrid.tsx](../../../components/CalendarGrid.tsx)（`CalendarDay` 介面新增 `tasks` 欄位；點擊條件從「有備註/請假/日出照才可點」放寬為「任何一天皆可點」；備註面板新增 8 項任務勾選狀態的小方塊顯示，比照管理後台個人逐日明細表的既有視覺語彙）；[app/(main)/dashboard/page.tsx](../../../app/(main)/dashboard/page.tsx)（型別同步新增 `tasks` 欄位）。
- **不影響**：打卡本身的提交邏輯、月曆上色邏輯（`getCalendarColor`）、既有備註/請假/日出照顯示皆不變。
