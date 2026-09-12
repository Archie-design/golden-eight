## 1. `lib/scoring.ts` 純函式

- [x] 1.1 新增 `calcDailyRateByDay(records, daysInMonth)`：輸入該月 `checkin_records`（含 `date`, `total_score`），輸出 `{ day: number; rate: number | null }[]`（無記錄的日子 `rate = null`），並確認既有本月 `calendar[]` 的 `score → color` 邏輯不受影響（可複用既有 `total_score` 讀法，不重複造輪子）
- [x] 1.2 新增 `calcHistoricalAvgDailyRate(recordsAcrossMonths)`：輸入多個月份的 `checkin_records`（含 `date`, `total_score`），依 `day-of-month`（1~31）分桶取平均達成率，輸出 `{ day: number; rate: number | null }[]`（該天完全沒有歷史紀錄則 `rate = null`）
- [x] 1.3 為兩個新函式撰寫最小驗證腳本或在 `scripts/` 下手動跑一次真實資料驗證（專案無測試套件，改用手動驗證：印出幾筆已知資料算出的結果並人工核對）— 已用臨時 Node 腳本驗證 3 個案例（有分、缺卡斷線、歷史平均），皆符合預期後刪除

## 2. API：`GET /api/stats/dashboard`

- [x] 2.1 僅在 `isCurrentMonth = true` 時，查詢上個月（`prevYm`，複用既有 `prevMonthDate` 推導邏輯）整月 `checkin_records`（`date, total_score`），轉為 `lastMonthDailyRates[]`
- [x] 2.2 僅在 `isCurrentMonth = true` 時，查詢該會員自 `effective_start_date`/`join_date` 起、至上月月底為止的歷史 `checkin_records`（`date, total_score`），呼叫 `calcHistoricalAvgDailyRate` 得出 `historicalAvgDailyRates[]`；若資料量隨年資增長明顯拖慢回應（實測後判斷），加上回溯月數上限（例如近 12 個月）— 已加上 `HISTORICAL_AVG_LOOKBACK_MONTHS = 12` 上限
- [x] 2.3 歷史月份模式（`isCurrentMonth = false`）確認回應不含 `lastMonthDailyRates` / `historicalAvgDailyRates`（或為空陣列），且既有欄位與行為不變 — 兩欄位初始化為 `[]`，僅 `isCurrentMonth` 分支內才查詢覆寫
- [ ] 2.4 手動以 `curl`/瀏覽器驗證：當月請求回傳兩個新欄位且長度與月份天數/上月天數一致；歷史月份請求不含新欄位或為空陣列 — **待使用者於瀏覽器登入真實帳號驗證**（涉及真實會員資料，未由 Claude 自動執行）

## 3. 前端：`DailyRateChart`

- [x] 3.1 新增 `lastMonthRates?` 與 `historicalAvgRates?` props，型別對應 API 回傳形狀
- [x] 3.2 將現有「本月折線 segments/dots 計算」邏輯抽成可重用的 helper，分別用於本月、上月、歷史平均三組資料，避免程式碼重複 — 抽成 `buildSegments()`
- [x] 3.3 繪製上月折線與歷史累積平均折線，配色/線型與本月折線、既有門檻虛線可視覺區分（見 design.md 決策 3）— 本月 amber 實線／上月 slate 虛線／歷史平均 violet 點虛線
- [x] 3.4 日期範圍篩選（全月 / 1–10 / 11–20 / 21–30）套用同一組 `startDay`/`endDay` 到三條線，確認三線同步縮放
- [x] 3.5 無資料時（`lastMonthRates` 未提供或全為 `null`；`historicalAvgRates` 同理）省略對應折線，不畫假資料 — 由 `hasLastMonth`/`hasHistAvg` 判斷
- [x] 3.6 新增圖例，標示本月／上月／歷史累積平均三條線（含無資料時的呈現，例如灰字「暫無資料」）

## 4. 前端：`app/(main)/dashboard/page.tsx` 串接

- [x] 4.1 將 API 回傳的 `lastMonthDailyRates` / `historicalAvgDailyRates` 傳入 `<DailyRateChart />`
- [x] 4.2 確認歷史月份檢視（`isCurrentMonth = false`）時不傳入這兩個 props（或傳空陣列），圖表僅顯示原本本月折線 + 門檻虛線 — 以 `data.isCurrentMonth ? … : undefined` 守衛

## 5. 驗證

- [x] 5.1 `npx tsc --noEmit` 通過
- [x] 5.2 `npm run lint` 通過（僅 1 個既有無關 warning：checkin/page.tsx 的 `<img>` LCP 提示）
- [ ] 5.3 手動跑 `npm run dev`，以至少三種帳號情境驗證圖表：(a) 有上月與歷史資料的老會員 (b) 剛滿一個月、僅有一個月歷史資料的會員 (c) 本月新加入、無上月資料的會員，確認對應折線正確顯示或省略 — **dev server 已啟動於 http://localhost:3000，待使用者登入真實帳號驗證**
- [ ] 5.4 手動驗證歷史月份回查（切換到上個月）時，圖表不顯示上月/歷史平均折線，且既有功能（月曆、任務統計等）不受影響 — **待使用者於瀏覽器驗證**
