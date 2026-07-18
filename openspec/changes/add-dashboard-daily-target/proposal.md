## Why

學員儀表板已顯示「累計得分 / 達成率 / 距目標差 / 目標分」，但這些都是**回顧**數字——學員知道「還差 76.5 分」，卻不知道「所以我接下來每天要拿幾分才追得回來」。缺一個把「距目標差」換算成「日均目標」的前瞻提醒，學員就得自己心算。加上這個換算，儀表板才從「你落後多少」進化到「你該怎麼追」。

## What Changes

- **新增「日均達標門檻」提醒**：`每天需分數 = 距目標差 ÷ 剩餘天數`，剩餘天數 = 今天到月底（含今天）。以一句話呈現於「距目標差」附近，如「還有 14 天，平均每天需 5.5 分達標」。
- **分情境呈現**：
  - 已達標（`remaining ≤ 0`）→「✅ 已達標，繼續保持！」
  - 一般（每天需 ≤ 8 分）→「還有 N 天，平均每天需 X 分達標 💪」
  - 已難達標（每天需 > 8 分，超過單日上限）→「本月已難達標，下月再拼！」
- **僅本月現時視圖**：歷史月（`isCurrentMonth = false`）不顯示此提醒（月已結束，無「接下來」可言）。
- **豁免成員**（本月不計分）：不顯示日均提醒（與既有豁免顯示一致）。

不改計分、月結、資料庫 schema。`remaining` 與 `targetScore` dashboard API 已回傳；本次僅新增「剩餘天數」與「日均需分」衍生值 + 前端一句話呈現。

## Capabilities

### New Capabilities
- `dashboard-daily-target`: 學員儀表板日均達標門檻提醒的能力——涵蓋剩餘天數與日均需分的計算、已達標／一般／已難達標三情境的呈現契約、以及本月與豁免的邊界。

### Modified Capabilities
<!-- 無：既有 dashboard-stats spec 未涵蓋日均目標提醒；本次為新增衍生欄位與呈現，不改既有 requirement。-->

## Impact

- **修改** `app/api/stats/dashboard/route.ts`：本月時多回 `daysLeft`、`dailyNeeded`（distToTarget ÷ daysLeft）；歷史月為 null。
- **修改** `app/(main)/dashboard/page.tsx`：於「距目標差」附近新增一句話提醒，依三情境呈現。
- **相依既有**：`stats.remaining`（距目標差）、`stats.targetScore`、`isCurrentMonth`、`getTodayTaipei`、`getMonthEnd`。
- 不影響 admin、settlement、leaderboard。
- 回滾：移除衍生欄位 + 前端一句話即可，無殘留狀態、無資料遷移。
