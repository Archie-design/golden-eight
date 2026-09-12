## Why

本月進度折線圖（`DailyRateChart`）目前只畫「本月每日達成率」+ 一條固定的等級門檻虛線，學員只能看到自己有沒有踩到及格線，看不出「跟過去的自己比」有沒有進步。使用者希望聚焦自我成長：在同一張圖上加畫「上個月」與「歷史累積平均」兩條參考線，讓學員一眼看出本月走勢是優於自己過去的常態、還是退步了。

## What Changes

- `DailyRateChart` 新增兩條參考折線（沿用既有等級門檻虛線的視覺語彙，另外配色以區分三線）：
  - **上個月折線**：上個月每日達成率，依「日序」對齊本月 X 軸（第 N 天 vs 第 N 天）；上月天數較少時线提前結束，不做外插。
  - **歷史累積平均折線**：學員入會以來所有已結束月份，依「日序」聚合的每日達成率平均值（例如所有月份第 5 天的達成率取平均，畫成第 5 天的點）。
  - 圖表新增圖例區分三條線（本月 / 上月 / 歷史平均），沿用現有色彩系統但另配可辨識顏色，避免與門檻虛線、及格/不及格紅黃點混淆。
- `GET /api/stats/dashboard` 回應新增歷史比較資料（上月每日達成率序列、歷史累積每日平均序列），供 `DailyRateChart` 使用；資料只在「本月現時視圖」（`isCurrentMonth = true`）計算並回傳，歷史月份檢視模式不顯示比較線（避免「拿歷史月份跟歷史月份比較」語意混亂，及重複计算成本）。
- 新加入未滿一個月（無上月資料）或無歷史资料的學員：對應折線省略不畫，不畫佔位假資料，圖例仍顯示但該線缺席或標示無資料。
- 日期切換到分頁選取範圍（全月 / 1–10 / 11–20 / 21–30）時，比較線需依相同 `startDay`/`endDay` 篩選區間，維持三線同步縮放。

## Capabilities

### New Capabilities
（無，此為既有 `dashboard-stats` 圖表能力的擴充，不引入新的頂層能力）

### Modified Capabilities
- `dashboard-stats`: 「儀表板 SHALL 在頂部顯示月度進度卡…每日達成率折線圖」之需求擴充為三線比較（本月 / 上月 / 歷史累積平均），並定義 API 回傳資料新增欄位。

## Impact

- **前端**：[components/DailyRateChart.tsx](../../../components/DailyRateChart.tsx)（新增兩條 polyline、圖例、無資料時的降級顯示）；[app/(main)/dashboard/page.tsx](../../../app/(main)/dashboard/page.tsx)（把新 API 欄位傳入 `DailyRateChart`，圖例文案）。
- **後端 API**：[app/api/stats/dashboard/route.ts](../../../app/api/stats/dashboard/route.ts) 新增查詢：上月同會員 `checkin_records`（依日序取每日達成率），以及歷史所有已結束月份的每日達成率依日序聚合平均。僅在 `isCurrentMonth` 時執行，避免拖慢歷史月份查詢。
- **共用邏輯**：可能新增 `lib/scoring.ts` 純函式（例如 `calcDailyRateSeries` / `calcHistoricalDailyAverage`），供 API route 呼叫並方便測試（雖無測試套件，仍維持既有「pure function in lib/scoring.ts」慣例）。
- **效能**：歷史累積平均需要掃描該會員所有歷史 `checkin_records`（隨會員年資增長而變大）；需评估是否加 `LIMIT`（例如僅近 12 個月）或一次查詢後在記憶體聚合，避免對資料庫造成不必要負擔。
- **不影響**：`monthly_summary`、settlement、achievement、其他頁面（leaderboard、admin）不受影響；歷史月份檢視模式（`isCurrentMonth = false`）之既有行為不變。
