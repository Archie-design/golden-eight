# Proposal

## Why

成員目前打卡完成後只看到一張「今日已打卡」確認卡，要看本月進度（累計得分、達成率、是否優於上月/自己的常態）得額外切到 `/dashboard` 頁面。成員打完卡的當下最在意「這一卡對本月狀況的影響」，此時提供即時回饋能強化「跟過去的自己比」的動機，也延續 [dashboard-chart-self-comparison](../dashboard-chart-self-comparison/proposal.md) 剛加上的三線比較折線圖的使用場景。

## What Changes

- 首次打卡成功（`POST /api/checkin/submit`）後，於打卡頁彈出一個「本月進度」彈窗，內容與 `/dashboard` 頁「月度進度卡」一致：累計得分、達成率、距目標差、剩餘天數提醒，以及 `DailyRateChart` 三線折線圖（本月／上月／歷史累積平均）。
- 修改當日打卡（`PATCH /api/checkin/submit`，誤觸回溯）**不**觸發此彈窗，避免每次訂正小錯誤都打斷使用者。
- 若同一次打卡同時解鎖成就，彈窗排序為：先顯示既有的成就 Modal（逐一跑完 `achQueue`），使用者關閉最後一個成就後，才接著顯示進度彈窗；不與成就 Modal 同時出現、不互相覆蓋。
- 打卡頁 `GET /api/checkin/today` 的既有回應不需變更；進度彈窗內容改為在提交成功後，額外呼叫既有的 `GET /api/stats/dashboard`（當月、免 `month` 參數）取得資料並渲染，不新建 API。
- 進度彈窗可手動關閉（提供關閉按鈕 / 點背景關閉），不強制互動。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `daily-checkin`: 新增「首次打卡成功後顯示本月進度彈窗」之行為需求，並明確排除修改打卡（PATCH）與成就彈窗佇列中的互動順序。

## Impact

- **前端**：[app/(main)/checkin/page.tsx](../../../app/(main)/checkin/page.tsx)（`handleSubmit` 的 POST 成功分支，新增彈窗狀態與觸發時機、成就佇列清空後的接續觸發）；複用 [components/DailyRateChart.tsx](../../../components/DailyRateChart.tsx) 與月度進度卡的數字呈現（可能抽出共用的小型展示元件，避免 dashboard 頁與 checkin 頁各寫一份 JSX）。
- **API**：不新增後端路由，直接複用既有 `GET /api/stats/dashboard`（已於 `dashboard-chart-self-comparison` 變更中擴充了 `lastMonthDailyRates` / `historicalAvgDailyRates`）。
- **效能**：打卡成功後多一次 `/api/stats/dashboard` 請求（而非把該查詢塞進 `/api/checkin/submit` 回應），維持兩個 API 的單一職責；需注意該請求為非同步載入，彈窗應有 loading 狀態而非等待後才開啟 Dialog。
- **不影響**：`/dashboard` 頁面本身、`monthly_summary`、成就系統計算邏輯皆不變。
