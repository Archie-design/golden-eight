## 1. 常數與純函式（lib/constants.ts + lib/scoring.ts）

- [x] 1.1 `lib/constants.ts` 新增 `PACE_OK_THRESHOLD = 0.85`（pace 二分點），並註明四象限語意
- [x] 1.2 `lib/scoring.ts` 新增純函式 `calcPaceStatus(member, stats, refDate, yearMonth)` 回傳 `{ pace, projRate, quadrant }`
- [x] 1.3 pace = `stats.totalScore / (expectedDays × 8 × threshold) × 100`，`expectedDays = expectedCheckinDays(member, ym, refDate)`，threshold 取 `LEVEL_THRESHOLDS[member.level]`
- [x] 1.4 projRate = `(stats.totalScore / elapsedDays × monthDays) / stats.maxScore × 100`，`elapsedDays = expectedCheckinDays(...)`（與 pace 分母同源，對齊個人 window），`monthDays` 為當月總天數
- [x] 1.5 quadrant：`maxScore===0 → 'exempt'`；否則 `paceOk = pace>=85`、`projOk = projRate >= threshold×100`，對應 `rescue/lukewarm/slow_start/safe`
- [x] 1.6 邊界防護：expectedDays 或 elapsedDays 為 0 時不除零（回 exempt 或安全預設）

## 2. Progress route 增加衍生欄位（app/api/stats/progress/route.ts）

- [x] 2.1 每列在 `isCurrentMonth === true` 時呼叫 `calcPaceStatus`，回傳 `pace`、`projRate`、`paceStatus`（quadrant）
- [x] 2.2 `isCurrentMonth === false`（歷史月）時，三欄回 null（不計算）
- [x] 2.3 型別/回傳形狀更新，確認既有欄位（totalScore/rate/passing/settled*）不變

## 3. 前端狀態欄改讀二維（app/(main)/admin/page.tsx）

- [x] 3.1 狀態欄：本月（非 useSettled）改讀 `paceStatus`，依 quadrant 顯示 🔴 真的要救 / 🟠 溫水 / 🟡 起步慢 / ✅ 安全 + 分色
- [x] 3.2 豁免成員（quadrant==='exempt' 或 exempted）顯「本月新進，不參與計分」，不顯象限
- [x] 3.3 歷史月（useSettled）維持既有 `settledPassing` 達標/未達標顯示，不出現象限 UI
- [x] 3.4 輔助數字：同格或 tooltip 顯示 `月率 X% ・ pace Y% ・ 月底預估 Z%`
- [x] 3.5 更新前端 row 型別（新增 pace/projRate/paceStatus 欄位，nullable）

## 4. 驗證

- [x] 4.1 `npx tsc --noEmit` + `npm run lint` 通過
- [x] 4.2 `openspec validate add-admin-pace-status --strict` 通過
- [x] 4.3 單元驗證 `calcPaceStatus`：四象限各一例（用 explore 的柯啟鴻/藍巧憶/高珮綺/黃名禎等資料對照）、豁免回 exempt、除零邊界
- [x] 4.4 以截圖 14 人資料回歸：結果應為 6 安全 / 3 溫水（藍巧憶/Eric/鄭聖諺）/ 5 要救（含高珮綺🔴嚴重）
- [ ] 4.5 手動：本月視圖狀態欄顯四象限；切歷史月維持月結顯示；豁免成員顯「本月新進」
