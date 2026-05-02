# Dashboard & Stats Capability

## Purpose

提供成員個人化儀表板，集中顯示當月進度、月曆視圖、各任務完成次數、連續打拳卡、近 6 月達成率趨勢、成就牆、LINE 綁定狀態、下月階梯選擇。儀表板 SHALL 支援歷史月份回查（透過月份導覽切換），歷史月份模式採用月底為計算基準。

## Requirements

### Requirement: 月份導覽
`/dashboard` 頁面 SHALL 在標題區提供左右箭頭月份切換。`selectedMonth` 預設為當月；切到歷史月份時各區塊資料同步切換。右箭頭在當月（`selectedMonth >= currentYearMonth`）時 MUST 停用。

#### Scenario: 切到上個月
- **WHEN** 使用者點左箭頭（當月為 5 月）
- **THEN** `selectedMonth = '2026-04'`，所有資料區塊重新載入

#### Scenario: 當月鎖右箭頭
- **WHEN** `selectedMonth = currentYearMonth`
- **THEN** 右箭頭 disabled

---

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

歷史月份模式 MUST 以月底（`getMonthEnd(yearMonth)`）為 `refDate` 呼叫 `calcMonthStats`，確保分母完整、不顯示「下月階梯選擇」按鈕。

#### Scenario: 載入當月儀表板
- **WHEN** 呼叫 `GET /api/stats/dashboard`（不帶 month）
- **THEN** 回傳當月即時資料，`isCurrentMonth = true`，refDate = today

#### Scenario: 載入歷史月份
- **WHEN** 呼叫 `GET /api/stats/dashboard?month=2026-04`
- **THEN** 回傳 4 月完整資料，`isCurrentMonth = false`，refDate = 2026-04-30

---

### Requirement: 月度進度卡
儀表板 SHALL 在頂部顯示月度進度卡，包含：累計得分、本月達成率、距目標差、剩餘天數、每日達成率折線圖。折線圖（`DailyRateChart`）SHALL 使用 `useMemo` 快取序列化資料以避免重渲染。

#### Scenario: 顯示本月進度
- **WHEN** 載入當月儀表板
- **THEN** 進度卡顯示 `totalScore / maxScore`、`rate%`、距 `targetScore` 還差幾分、剩 N 天

---

### Requirement: 月曆視圖
儀表板 SHALL 顯示月曆網格，每日依當日 `total_score` 上色：

- 灰：未報（無記錄）
- 紅：0–4 分
- 橘：5–6 分
- 綠：7 分
- 金：8 分

顏色定義 MUST 集中於 `lib/constants.ts` 的 `CALENDAR_COLORS` 與 `getCalendarColor(score)` 函式。

#### Scenario: 月曆顯示
- **WHEN** 成員 5/3 得 8 分、5/4 得 6 分、5/5 未打卡
- **THEN** 月曆 5/3 顯示金色、5/4 橘色、5/5 灰色

---

### Requirement: 任務完成統計
儀表板 SHALL 顯示當月各任務完成次數（`taskCounts[8]`）與工時月累計（`workHours`）。每項任務 SHALL 顯示為條狀進度（完成天數 / 有效天數）。

#### Scenario: 工作 8 小時統計
- **WHEN** 成員當月有效 22 天、工時月累計 175 小時
- **THEN** 任務 5 條狀顯示 `175h / 176h`

---

### Requirement: 連續打拳卡
連續打拳卡 SHALL 顯示：

- 當月模式：當月「目前連續」+ 「最長連續」
- 歷史月份模式：當月「最終連續天數」（最後一筆打卡的 `punch_streak`）

#### Scenario: 當月目前連續
- **WHEN** 5/15 載入當月儀表板，過去 5 天連打
- **THEN** 連續打拳卡顯示「目前 5 天 / 最長 5 天」

#### Scenario: 歷史月份最終連續
- **WHEN** 5 月載入 4 月儀表板
- **THEN** 卡片顯示「最終 N 天」（4/30 該記錄的 `punch_streak`）

---

### Requirement: 近 6 月趨勢
儀表板 SHALL 在固定區塊顯示近 6 個月個人達成率折線 + 群組平均對照。`GET /api/stats/history` SHALL 回傳最近 6 筆 `monthly_summary` 資料 + 每月群組平均。此區塊 MUST 不隨 `selectedMonth` 切換而變動（總是顯示最近 6 月）。

#### Scenario: 載入趨勢
- **WHEN** 載入儀表板
- **THEN** 折線圖顯示成員過去 6 個月達成率與群組平均（兩條線）

---

### Requirement: 成就牆
儀表板 SHALL 渲染成就牆（45 格），透過 `<AchievementWall unlockedCodes={...} />` 顯示。已解鎖採對應 tier 顏色（青銅/白銀/黃金/神話/特殊）；未解鎖灰色。每個徽章為 hexagonal SVG + Lucide icon + 名稱獨立行。

#### Scenario: 顯示解鎖徽章
- **WHEN** 成員已解鎖 `T1_STREAK_3`（青銅）
- **THEN** 對應徽章彩色、名稱顯示「早鳥初心」

#### Scenario: 未解鎖徽章
- **WHEN** 成員尚未解鎖 `MONTH_STREAK_6`
- **THEN** 對應徽章灰色，名稱仍可讀

---

### Requirement: LINE 綁定卡
儀表板 SHALL 顯示 LINE 綁定狀態：

- 已綁定：顯示 LINE 頭像、display name、解除綁定按鈕
- 未綁定：顯示綁定按鈕（呼叫 `GET /api/auth/line` 開啟 OAuth）

#### Scenario: 已綁 LINE
- **WHEN** 成員 `line_user_id` 不為 NULL
- **THEN** 卡片顯示頭像 + display name + 解除按鈕

---

### Requirement: 下月階梯選擇
當月模式（`isCurrentMonth = true`）且當前日期 ≥ 25 日時，儀表板 SHALL 顯示「選擇下月階梯」區塊，呼叫 `POST /api/auth/next-level`。歷史月份模式 MUST 不顯示此區塊。

#### Scenario: 25 日後當月模式顯示
- **WHEN** 5/26 載入當月儀表板
- **THEN** 顯示「選擇下月階梯」按鈕（黃金/白銀/青銅）

#### Scenario: 歷史月份隱藏
- **WHEN** 載入歷史月份儀表板
- **THEN** 不顯示下月階梯區塊

---

### Requirement: AbortController 防止 race condition
儀表板 fetch SHALL 使用 `AbortController` 包裝，月份切換時 abort 前次請求避免亂序覆寫資料。

#### Scenario: 快速切換月份
- **WHEN** 使用者快速連按左箭頭切月
- **THEN** 前次請求被 abort，僅最終選擇月份的資料寫入 state

---

## Data Source

主要查詢：`checkin_records`、`monthly_summary`、`achievements`、`members`（LINE 欄位 + level + next_level）。當月 `monthSummary` 即時 `calcMonthStats`；歷史月份優先讀 `monthly_summary`，若無則 `calcMonthStats(refDate=monthEnd)`。

## Notes

- `RateChart`（近 6 月趨勢）作為獨立元件不重渲染：依 `selectedMonth` 之外的資料源
- 月曆顏色分級為純函式 `getCalendarColor(score)`，可在其他頁面複用（如 admin/全員進度）
