## MODIFIED Requirements

### Requirement: 儀表板 API
`GET /api/stats/dashboard?month=YYYY-MM` SHALL 接受可選 `month` 參數（預設當月）並回傳該月份的：

- `monthSummary`：累計得分、達成率、距目標差、剩餘天數
- `dailyRates[]`：每日達成率（折線圖用）
- `calendar[]`：月曆每日得分（顏色分級用）
- `taskCounts[8]`：當月各任務完成次數
- `workHours`：月累計工時
- `streak`：當月目前連續 / 最長連續打拳；歷史月份顯示最終連續
- `achievements[]`：成員所有解鎖成就 codes（成就牆用）
- `lineStatus`：綁定狀態 + display name + picture URL
- `nextLevel`：當月下月階梯選擇（25 日後可選）
- `monthlySummary`（歷史月份）：月結後的 settled 數據（若已月結）
- `isCurrentMonth`：是否為當月
- `lastMonthDailyRates[]`（僅 `isCurrentMonth = true` 時）：上個月每日達成率序列，依日序（第 1 天、第 2 天…）排列，供本月進度折線圖比較用
- `historicalAvgDailyRates[]`（僅 `isCurrentMonth = true` 時）：學員歷史所有已結束月份，依日序聚合的每日達成率平均值序列

歷史月份模式 MUST 以月底（`getMonthEnd(yearMonth)`）為 `refDate` 呼叫 `calcMonthStats`，確保分母完整、不顯示「下月階梯選擇」按鈕。歷史月份模式（`isCurrentMonth = false`）MUST NOT 回傳 `lastMonthDailyRates` 與 `historicalAvgDailyRates`（或回傳空陣列），避免「歷史月份互比歷史月份」的語意混亂與額外查詢成本。

#### Scenario: 載入當月儀表板
- **WHEN** 呼叫 `GET /api/stats/dashboard`（不帶 month）
- **THEN** 回傳當月即時資料，`isCurrentMonth = true`，refDate = today，並附帶 `lastMonthDailyRates` 與 `historicalAvgDailyRates`

#### Scenario: 載入歷史月份
- **WHEN** 呼叫 `GET /api/stats/dashboard?month=2026-04`
- **THEN** 回傳 4 月完整資料，`isCurrentMonth = false`，refDate = 2026-04-30，`lastMonthDailyRates` 與 `historicalAvgDailyRates` 為空陣列或不出現

### Requirement: 月度進度卡
儀表板 SHALL 在頂部顯示月度進度卡，包含：累計得分、本月達成率、距目標差、剩餘天數、每日達成率折線圖。折線圖（`DailyRateChart`）SHALL 使用 `useMemo` 快取序列化資料以避免重渲染。

僅本月現時視圖（`isCurrentMonth = true`）時，折線圖 SHALL 額外疊加兩條參考線，並提供圖例區分三條線：

- **上個月折線**：上個月每日達成率，依日序對齊本月 X 軸（本月第 N 天對齊上月第 N 天）。上月天數少於本月時，該線在對應天數後不再延伸（不外插）。
- **歷史累積平均折線**：學員入會以來所有已結束月份，依日序聚合的每日達成率平均值。

日期範圍篩選（全月 / 1–10 / 11–20 / 21–30）套用時，上個月折線與歷史累積平均折線 MUST 套用相同的 `startDay`/`endDay` 篩選區間，與本月折線同步縮放。

若學員無上月資料（例如新加入未滿一個月）或無歷史資料（例如僅有本月一個月的紀錄），對應折線 SHALL 省略不畫（不得以假資料佔位），圖例仍列出該線但可標示暫無資料。歷史月份檢視模式（`isCurrentMonth = false`）MUST NOT 顯示這兩條參考線。

#### Scenario: 顯示本月進度
- **WHEN** 載入當月儀表板
- **THEN** 進度卡顯示 `totalScore / maxScore`、`rate%`、距 `targetScore` 還差幾分、剩 N 天

#### Scenario: 本月折線疊加比較線
- **WHEN** 載入當月儀表板，且該學員有上月資料與歷史資料
- **THEN** 折線圖同時顯示本月、上月、歷史累積平均三條折線，並顯示三線圖例

#### Scenario: 新加入學員無上月資料
- **WHEN** 學員入會未滿一個月，本月為其第一個計分月
- **THEN** 折線圖僅顯示本月折線，上月折線與歷史累積平均折線省略不畫（或圖例標示暫無資料）

#### Scenario: 歷史月份檢視不顯示比較線
- **WHEN** 使用者切換至歷史月份（`isCurrentMonth = false`）
- **THEN** 折線圖僅顯示該月每日達成率折線與門檻虛線，不顯示上月折線與歷史累積平均折線
