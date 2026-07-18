## Why

管理員後台「全員進度」的狀態欄在月中對每個人都顯示「❌ 未達標」——因為 `passing` 用「月率 ≥ 門檻」判定，而月率的分母是整月（`maxScore = fullMonthDays × 8`）。月中時，即使一位學員每天完美打卡，到 7/18 也只有 58%（18÷31 天），全員必然低於各階級門檻（青銅 60%／白銀 70%／黃金 80%）。結果是「全員紅」的假象，管理員無法從中分辨「數學上必然的紅」與「真的沒跟上的紅」，也就無法把注意力放在真正落隊、需要拉拔的學員身上。

## What Changes

- **新增「pace」（回顧軸）**：`pace = 總分 ÷ (到今天應打天數 × 8 × 該階級門檻)`。回答「跟不跟得上到今天為止的達標軌跡」。二分點 **85%**（≥85% 視為跟得上）。
- **新增「月底預估」（前瞻軸）**：`projRate = (總分 ÷ 已過天數 × 當月天數) ÷ 月滿分`，線性外推。二分點 = 該階級門檻。回答「照現在速度，月底撞不撞得到門檻」。
- **新增二維綜合狀態（quadrant）**，取代狀態欄的二元「達標/未達標」：
  - 🔴 **真的要救**：pace < 85% 且 月底預估 < 門檻（過去落後、未來也撞不到）
  - 🟠 **溫水（易忽略）**：pace ≥ 85% 但 月底預估 < 門檻（看似跟上、月底卻要被罰）
  - 🟡 **起步慢（追趕中）**：pace < 85% 但 月底預估 ≥ 門檻（起步慢、正在追回）
  - ✅ **安全**：pace ≥ 85% 且 月底預估 ≥ 門檻
- **豁免成員**（本月不計分，`maxScore = 0`）：狀態欄顯示「本月新進」，不分級。
- **僅本月現時視圖套用**：歷史已月結月份（`isCurrentMonth = false`）維持既有月結 `passing` 顯示，不計算 pace／預估（月已結束，兩者無意義）。
- 月率、pace%、月底預估% 保留為輔助數字（次要呈現）；主視覺是 quadrant 分色。

不改計分、月結、罰款計算或資料庫 schema。純粹在既有 progress route 增加衍生欄位 + 前端狀態欄改讀。

## Capabilities

### New Capabilities
- `admin-pace-status`: 管理員後台全員進度的二維落隊偵測能力——涵蓋 pace（回顧軸）與月底預估（前瞻軸）的計算、二維四象限綜合狀態、豁免成員與歷史月份的邊界處理、以及狀態欄的分級呈現契約。

### Modified Capabilities
<!-- 無：`dashboard-stats` 既有 spec 未涵蓋管理員進度狀態欄的分級語意；本次為新增衍生欄位與呈現，
     以新 capability 涵蓋，不改動既有 requirement 行為。-->

## Impact

- **修改** `app/api/stats/progress/route.ts`：每列（僅 `isCurrentMonth` 時）多回 `pace`、`projRate`、`paceStatus`（quadrant）三欄。
- **修改** `lib/scoring.ts`（或新增 helper）：新增 `calcPaceStatus(member, stats, refDate, yearMonth)` 純函式，回傳 pace、projRate、quadrant。積木已存在（`expectedCheckinDays`、`calcMonthStats`、`LEVEL_THRESHOLDS`）。
- **修改** `app/(main)/admin/page.tsx`：狀態欄由二元 `passing` 改讀 `paceStatus`（四象限分色）；歷史月（`useSettled`）維持既有 `settledPassing`。
- **相依既有**：`LEVEL_THRESHOLDS`（門檻）、`expectedCheckinDays`（應打天數）、`isCurrentMonth` 旗標、`useSettled` 前端切換。
- 不影響 leaderboard、settlement、penalty、export（它們不讀狀態欄語意）。
- 回滾：移除衍生欄位 + 前端還原狀態欄即可，無殘留狀態、無資料遷移。
