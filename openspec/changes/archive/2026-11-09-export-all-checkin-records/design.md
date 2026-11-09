# Design

## Context

既有 `GET /api/admin/export`（[app/api/admin/export/route.ts](../../../app/api/admin/export/route.ts)）是本次最直接可參考的範例：`requireAdmin()` 守衛、`csvRow`/`csvField` 逐欄跳脫、UTF-8 BOM + `Content-Disposition: attachment` 的回應慣例。本次新端口結構相同，差異在於查詢對象（`checkin_records` 逐筆，而非 `monthly_summary` 彙總）與時間範圍（跨月/全歷史，而非單一月）。

資料量級：約 3229 筆 `checkin_records`、32 位成員（見 proposal.md - Impact），單次查詢整表後在記憶體組 CSV 即可，不需要分頁、串流或背景任務。

見 proposal.md - Why / What Changes；規格見 `specs/admin-console/spec.md`。

## Goals / Non-Goals

**Goals:**
- 一次查詢取得（可選範圍內的）全部 `checkin_records`，組成逐列 CSV
- 欄位命名與型別呈現對一般使用者（非工程師，可能用 Excel 開）友善易懂
- 不影響既有 `GET /api/admin/export`（月結摘要）的任何行為

**Non-Goals:**
- 不處理未來資料量大幅增長後的效能問題（分頁、串流、背景任務）——目前規模不需要，若日後資料量級改變（例如數萬筆以上）需另外評估
- 不在本次新增「依成員篩選」或其他維度的篩選參數——只做時間範圍篩選，符合「全部定課紀錄」的原始訴求
- 不改變 `checkin_records` 的任何既有資料或計分邏輯，純粹唯讀匯出

## Decisions

### 1. 單一查詢撈 `checkin_records`，用 `members` 的一次性批次查詢補上姓名
**選擇**：先用 `startMonth`/`endMonth`（若有）過濾 `checkin_records.date` 範圍，查出所有符合的列；再對出現過的 `member_id` 批次查一次 `members(id, name)`，記憶體 join 補上姓名欄位。

**理由**：Supabase JS client 對 `select('*, members(name)')` 這種 join 語法在單表大量列時表現穩定（`/api/admin/export` 已經用過類似的 `members(...)` embed），但本次每一列都要補姓名、且列數遠多於 `monthly_summary`（3229 vs 幾十列），選擇「先撈全部 `checkin_records`，再一次性批次查成員姓名表」比逐列 embed 查詢更直觀、也更容易預期效能（兩次查詢，皆為單次往返）。

**替代方案考慮**：用 Supabase 的 embed join（`checkin_records.select('*, members(name)')`）——技術上可行，效能在目前規模下也沒有實質差異，兩種寫法皆可接受；選擇分離查詢純粹是可讀性與除錯便利性考量，不是效能驅動的決策。

### 2. `tasks: boolean[8]` 展開為 8 個獨立欄位，欄名沿用 `lib/constants.ts` 的 `TASKS` 名稱
**選擇**：CSV header 的 8 項任務欄位直接用 `TASKS[i].name`（例如「早睡早起」「破曉打拳」...），儲存格內容為「是」/「否」字串，而非 `true`/`false` 或單一 JSON 陣列欄位。

**理由**：與既有 `/api/admin/export` 的 `r.passing ? '是' : '否'`、`r.is_dawn_king ? '是' : '否'` 呈現慣例一致；8 個獨立欄位讓使用者在 Excel 用篩選/樞紐分析時可以直接依單一任務欄位篩選，比塞一個 JSON 字串欄位實用得多。

**替代方案考慮**：輸出單一 `tasks` 欄位存 `"1,0,1,1,0,0,1,0"` 或 JSON——對非工程背景的使用者（管理員，可能只用 Excel）不友善，不採用。

### 3. 時間範圍參數：`startMonth`/`endMonth`（月份顆粒度），而非精確日期
**選擇**：沿用 `yearMonth` 類參數的既有慣例（`/api/admin/export` 用 `yearMonth`），本次用一對 `startMonth`/`endMonth`（`YYYY-MM`），內部轉換成 `startMonth-01` ~ `getMonthEnd(endMonth)` 的日期範圍查詢。

**理由**：管理員的使用情境是「我要看某幾個月的資料」或「全部」，月份顆粒度已經足夠，且與專案其餘月份相關參數（`yearMonth`）的慣例一致，不需要額外引入日期選擇器 UI。

## Risks / Trade-offs

- **[風險] 若未設定 `startMonth`/`endMonth`，查詢會掃全表** → 可接受：目前規模（3229 筆）掃全表成本極低；若未來資料量顯著增長，屆時可再評估是否需要加上預設範圍或分頁，不在本次處理。
- **[Trade-off] 不做依成員篩選** → 可接受：既有「個人每日記錄查詢」分頁已經能單人查詢，本次端口的定位是「全員批次匯出」，兩者互補、不重疊。
