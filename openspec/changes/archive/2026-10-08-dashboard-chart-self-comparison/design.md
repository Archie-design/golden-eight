## Context

`GET /api/stats/dashboard` 目前僅查詢「選定月份」的 `checkin_records`（[app/api/stats/dashboard/route.ts:26-31](../../../app/api/stats/dashboard/route.ts)），並在前端 `DailyRateChart` 畫出單一本月每日達成率折線 + 一條固定等級門檻虛線（[components/DailyRateChart.tsx](../../../components/DailyRateChart.tsx)）。要加上「上月」與「歷史累積平均」兩條線，需要在 API 端多抓兩批資料並做日序聚合，再交給前端疊圖。

參考 proposal.md - Why / What Changes；規格見 `specs/dashboard-stats/spec.md`。

## Goals / Non-Goals

**Goals:**
- 在本月現時視圖，新增「上月」「歷史累積平均」兩條依日序對齊的參考折線
- 新資料查詢與計算只在 `isCurrentMonth = true` 時執行，不拖慢歷史月份查詢路徑
- 歷史累積平均的計算成本可控，不隨會員年資無限增長查詢負擔

**Non-Goals:**
- 不修改近 6 月趨勢卡（`RateChart` / `/api/stats/history`）的既有邏輯，那是月級別的比較，與本次日級別比較是獨立需求
- 不新增歷史月份檢視模式下的比較線（規格已明定僅本月現時視圖顯示）
- 不處理「上月也是豁免月（新進不參與計分）」以外的特殊會員狀態設計（沿用現有 `calcMonthStats` 豁免邏輯即可，比較線在無資料時單純省略）

## Decisions

### 1. 歷史累積平均：只抓「日期」與「total_score」，在應用層依日序分桶平均，不新增 SQL 聚合函式
**選擇**：一次查詢該會員所有歷史 `checkin_records`（`date < 本月月初`，且可選限制回溯區間，見下），只選 `date, total_score` 兩欄，於 Node 端依 `day-of-month` 分桶（1~31）逐桶取平均。

**理由**：
- 現有 codebase 對「跨月聚合」的慣例是在 `lib/scoring.ts` 寫 pure function 加上一次性查詢（如 `calcMonthStats`），並無使用 Postgres RPC 做逐日聚合的先例；引入新 RPC 增加維運成本，換來的效能收益在目前規模（單一健身社群，會員數與月數均為中小量級）不成比例。
- day-of-month 分桶邏輯（1 號到 31 號，2 月無 29~31 號等）用陣列 index 天然表達，比 SQL `GROUP BY EXTRACT(DAY FROM date)` 更容易與既有 `DailyRateChart` 的 `day` 索引對齊。

**替代方案考慮**：
- Postgres RPC 做 `GROUP BY EXTRACT(DAY FROM date)` 平均：效能較好但引入新遷移與新的資料庫函式，超出本次改動的必要範圍。
- 只用 `monthly_summary.rate`（月級平均）取代「歷史累積平均」：不符合使用者需求——使用者明確要「日達成率」的歷史平均折線，不是月平均的一條水平線。

**限制回溯區間**：為避免資深會員（例如兩年資歷）查詢每次都掃全部歷史，`historicalAvgDailyRates` 的計算 SHOULD 限制在 `effective_start_date`/`join_date` 起算，但實作時 MAY 加上例如「最近 12 個月」的上限（可在 tasks 階段依實際資料量決定是否需要），只要不改變「依日序平均」的規格語意即可。

### 2. 上月折線資料：獨立一次查詢上月整月 `checkin_records`，前端依 `day` 直接對應
**選擇**：以 `prevYm`（複用既有算法，見 [route.ts:87-89](../../../app/api/stats/dashboard/route.ts) 的 `prevMonthDate` 推導）查一次上月 `date, total_score`，轉成 `{ day, rate }[]`（`rate = round(total_score/8*100)`），沒有記錄的日子回傳 `null`（不外插、不補 0）。

**理由**：與本月 `calendar[]` 的資料形狀一致（day + score-derived rate），前端 `DailyRateChart` 現有的「score 為 null 則折線斷開」邏輯可直接複用，不需要新的斷線判斷規則。

### 3. 前端：`DailyRateChart` 新增 props，斷線與配色沿用既有 pattern
**選擇**：`DailyRateChart` 新增 `lastMonthRates?: { day: number; score: number | null }[]` 與 `historicalAvgRates?: { day: number; rate: number | null }[]` 兩個 optional props；沒有傳入或全為 null 時，該折線不渲染（對應規格「無資料時省略不畫」）。三條線的 `segments` 計算共用同一段 `useMemo` 邏輯（抽成同一個 helper 呼叫三次，或迴圈跑三組資料），避免程式碼重複。

**配色**：本月線沿用既有 `#f59e0b`（amber）；上月線用中性灰階但與「歷史 6 月趨勢圖」的群組平均虛線（`#9ca3af` dashed）區隔——可用同色不同 dash pattern，或另配一色（例如藍灰 `#94a3b8` 實線細一點）。歷史累積平均線建議用第三色（例如紫灰 `#a78bfa`）並用點狀 `strokeDasharray`，確保三線 + 門檻虛線 + 及格/不及格圓點 在同一張 200px 高的 SVG 內仍可辨識。實際配色由實作階段（tasks）視覺驗證微調，此處只定調「三線需可視覺區分，不能與既有門檻虛線或圓點顏色衝突」。

### 4. 計算邏輯放在 `lib/scoring.ts`（純函式），API route 只負責查詢與組裝
**選擇**：新增 `calcDailyRateByDay(records, daysInMonth)` 與 `calcHistoricalAvgDailyRate(recordsAcrossMonths)` 之類的 pure function，輸入是已查好的 `checkin_records` 陣列，輸出是依日序排列的陣列。API route 僅做 Supabase 查詢與呼叫這些函式。

**理由**：符合現有 `lib/scoring.ts` 的慣例（純函式、無 I/O，方便未來若補測試套件可單元測試），也讓 `dashboard/route.ts` 維持薄封裝。

## Risks / Trade-offs

- **[風險] 歷史累積平均查詢隨會員年資增長變大** → 緩解：查詢只選兩欄（`date, total_score`），並在 tasks 階段依實測資料量決定是否加上回溯月數上限（如近 12 個月），不影響規格定義的「依日序平均」語意。
- **[風險] 三線 + 門檻虛線 + 及格/不及格圓點同時顯示可能造成視覺雜訊，尤其手機窄螢幕** → 緩解：圖例可讓使用者理解三線用途；必要時歷史平均線可用較細/較淡的樣式降低視覺權重，確保本月實際折線仍是視覺焦點。實際樣式於實作階段迭代確認。
- **[風險] 上月為「新進不參與計分」的豁免月，導致上月折線全為 null** → 緩解：符合規格「無資料時省略不畫」，不需特殊處理，行為與「無上月資料」一致。
- **[Trade-off] 新增兩個查詢會略增加當月儀表板 API 的延遲** → 可接受：僅本月現時視圖觸發，且歷史月份路徑（較常見的回查情境）不受影響；與現有「近 6 月趨勢」`/api/stats/history` 的查詢量級相近。
