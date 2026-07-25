## 1. Dashboard route 衍生欄位（app/api/stats/dashboard/route.ts）

- [x] 1.1 計算 `daysLeft = 月底day − 今天day + 1`（僅本月；含今天，≥1）
- [x] 1.2 計算 `dailyNeeded = stats.remaining / daysLeft`（四捨五入 1 位小數）
- [x] 1.3 判定 `targetStatus`：`remaining<=0 → 'achieved'`；`dailyNeeded>8 → 'unreachable'`；否則 `'on_track'`
- [x] 1.4 僅 `isCurrentMonth === true` 且非豁免（`stats.maxScore > 0`）時回這三欄；否則回 null
- [x] 1.5 確認既有回傳欄位（totalScore/rate/targetScore/remaining…）不變

## 2. 前端一句話提醒（app/(main)/dashboard/page.tsx）

- [x] 2.1 更新 dashboard 資料型別，新增 `daysLeft`、`dailyNeeded`、`targetStatus`（nullable）
- [x] 2.2 於「距目標差」附近加提醒行，依 `targetStatus` 呈現三情境
- [x] 2.3 achieved → 「✅ 已達標，繼續保持！」（綠）
- [x] 2.4 on_track → 「還有 {daysLeft} 天，平均每天需 {dailyNeeded} 分達標 💪」
- [x] 2.5 unreachable → 「本月已難達標，下月再拼！」（灰）
- [x] 2.6 targetStatus 為 null（歷史月/豁免）時不顯示提醒

## 3. 驗證

- [x] 3.1 `npx tsc --noEmit` + `npm run lint` 通過
- [x] 3.2 `openspec validate add-dashboard-daily-target --strict` 通過
- [x] 3.3 單元/邏輯驗證：柯啟鴻(剩76.5/14天→5.5)、黃名禎(剩36→2.6)、高珮綺(剩94.5→6.8)；已達標→achieved；剩很多→unreachable(>8)；月底當天 daysLeft=1 不除零
- [ ] 3.4 手動：本月儀表板顯提醒；切歷史月不顯；豁免成員不顯；達標者顯鼓勵語
