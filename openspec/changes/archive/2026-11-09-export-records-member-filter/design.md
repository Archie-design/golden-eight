# Design

## Context

`GET /api/admin/export-records`（[app/api/admin/export-records/route.ts](../../../app/api/admin/export-records/route.ts)）目前查詢邏輯：`checkin_records` 依 `startMonth`/`endMonth` 篩日期範圍，不篩成員。管理後台「罰款總結」Tab（[app/(main)/admin/page.tsx](../../../app/(main)/admin/page.tsx)）已有 `members` 狀態（活躍成員清單）供其他分頁（如「個人每日記錄查詢」的單選 `Select`）使用，但沒有多選 UI 元件——專案的 `components/ui/` 只有 `select.tsx`（單選），沒有 checkbox、popover 或 command 元件。

見 proposal.md - Why / What Changes；規格見 `specs/admin-console/spec.md`。

## Goals / Non-Goals

**Goals:**
- `GET /api/admin/export-records` 支援 `memberIds` 查詢參數（逗號分隔），可與 `startMonth`/`endMonth` 並用
- 管理後台提供可勾選多位成員的介面，不勾選時維持現有「匯出全員」行為
- 不引入新的 UI 套件依賴

**Non-Goals:**
- 不做「全選/取消全選」按鈕（32 位成員量級不大，手動勾選可接受；若未來成員數顯著增加可再評估）
- 不做搜尋框篩選成員名單（同上，量級小不需要）
- 不改變 `startMonth`/`endMonth` 既有行為

## Decisions

### 1. `memberIds` 用逗號分隔字串，而非多個同名查詢參數
**選擇**：`?memberIds=M001,M003` 而非 `?memberIds=M001&memberIds=M003`。

**理由**：與專案既有 URL 參數風格一致（`yearMonth`、`startMonth` 皆為單一字串值），前端用 `window.location.href` 組 URL 時（既有 `handleExportAllRecords` 的呼叫方式）字串串接比處理陣列參數簡單；後端只需 `.split(',')` 解析。

### 2. 多選介面：原生 checkbox + flex-wrap 成員晶片，不引入新 shadcn 元件
**選擇**：在「全部紀錄 CSV」按鈕上方或旁邊，新增一個可展開/固定顯示的成員晶片區塊，每位成員一個可點擊切換的 checkbox + 姓名晶片（選中時邊框變色，比照專案既有互動語彙如 `DailyRateChart` 的分段按鈕、`CalendarGrid` 圖例的視覺風格）。

**理由**：32 位成員的量級，平鋪顯示不會造成版面壓力；專案目前沒有 Popover/Command 元件，臨時引入只為了這一個功能不符合成本效益；原生 checkbox 搭配既有 Tailwind 樣式即可達成「可勾選、視覺上看得出已選」的核心需求。

**替代方案考慮**：新增 shadcn Popover + Command 做標準下拉多選——更貼近一般 SaaS 後台的視覺標準，但增加兩個新元件依賴，對於一個使用頻率不高的管理員工具功能，投入產出比不划算，不採用。

### 3. 後端篩選：`memberIds` 存在時加一個 `.in('member_id', ids)` 條件
**選擇**：解析 `memberIds` 查詢參數（`split(',')`、過濾空字串），非空時對既有 Supabase query builder 鏈加上 `.in('member_id', memberIds)`。

**理由**：與既有 `startMonth`/`endMonth` 的 `.gte()`/`.lte()` 鏈式寫法一致，Supabase query builder 原生支援 `.in()`，不需要額外處理。

## Risks / Trade-offs

- **[風險] 使用者輸入的 `memberIds` 可能包含不存在的成員編號** → 可接受：`.in()` 查詢對不存在的 ID 自然不會匹配任何列，不會報錯，CSV 僅包含有效成員的資料；不需要額外驗證。
- **[Trade-off] 不做全選/搜尋** → 可接受：32 位成員的勾選量級，省略這些便利功能不影響可用性，且可在未來有需要時再補上，不影響本次 API 與資料流設計。
