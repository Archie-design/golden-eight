# Spec Delta

## MODIFIED Requirements

### Requirement: 儀表板 API
`GET /api/stats/dashboard?month=YYYY-MM` SHALL 接受可選 `month` 參數（預設當月）並回傳該月份的：

- `monthSummary`：累計得分、達成率、距目標差、剩餘天數
- `dailyRates[]`：每日達成率（折線圖用）
- `calendar[]`：月曆每日得分（顏色分級用），每日物件 SHALL 包含 `tasks: boolean[8] | null`（當日 8 項任務完成狀態；無打卡紀錄時為 `null`）
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

#### Scenario: 日曆包含當日任務明細
- **WHEN** 成員 5/3 完成任務 1、2、4、7（其餘未完成）
- **THEN** `calendar[]` 中 5/3 的物件 `tasks = [true, true, false, true, false, false, true, false]`

#### Scenario: 未打卡日無任務明細
- **WHEN** 成員 5/5 無打卡紀錄
- **THEN** `calendar[]` 中 5/5 的物件 `tasks = null`

### Requirement: 月曆視圖
儀表板 SHALL 顯示月曆網格，每日依當日 `total_score` 上色：

- 灰：未報（無記錄）
- 紅：0–4 分
- 橘：5–6 分
- 綠：7 分
- 金：8 分

顏色定義 MUST 集中於 `lib/constants.ts` 的 `CALENDAR_COLORS` 與 `getCalendarColor(score)` 函式。

月曆每一格 SHALL 可點擊展開查看當日明細（不限於有備註或請假事由的日子）。有打卡紀錄的日子，展開面板 MUST 顯示該日 8 項任務的完成狀態；既有的備註、請假事由顯示方式不變。未打卡且未請假的日子，展開面板 SHALL 顯示「當日未打卡」提示，MUST NOT 顯示 8 項任務皆為未完成的勾選狀態（避免呈現無意義的「全部未完成」清單）。

#### Scenario: 月曆顯示
- **WHEN** 成員 5/3 得 8 分、5/4 得 6 分、5/5 未打卡
- **THEN** 月曆 5/3 顯示金色、5/4 橘色、5/5 灰色

#### Scenario: 點擊有打卡的日子查看任務明細
- **WHEN** 成員點擊 5/3（已打卡，完成 6 項任務）
- **THEN** 展開面板顯示該日 8 項任務的完成/未完成狀態

#### Scenario: 點擊未打卡的日子
- **WHEN** 成員點擊 5/5（無打卡紀錄、未請假）
- **THEN** 展開面板顯示「當日未打卡」提示，不顯示 8 項任務勾選清單
