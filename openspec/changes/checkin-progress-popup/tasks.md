# Tasks

## 1. 抽出共用元件 `MonthProgressCard`

- [x] 1.1 新建 `components/MonthProgressCard.tsx`：把 [app/(main)/dashboard/page.tsx](../../../app/(main)/dashboard/page.tsx) 中「月份進度」卡片內的統計數字區塊（累計得分/達成率/距目標差三欄、"目標 N 分"、`targetStatus` 三種文案分支）與 `<DailyRateChart />` 抽出，接受 props：`totalScore, maxScore, rate, targetScore, remaining, daysLeft, dailyNeeded, targetStatus, level, calendar, lastMonthDailyRates, historicalAvgDailyRates`（不含豁免態文案、不含「下月階梯選擇」區塊——那些留在 dashboard 頁）
- [x] 1.2 dashboard 頁改用 `<MonthProgressCard />`，確認視覺與互動（分段篩選、折線顯示）與抽取前一致
- [x] 1.3 `npx tsc --noEmit` 通過，確認 props 型別與 `DashboardData` 介面對應正確

## 2. 打卡頁：新增進度彈窗狀態與資料載入

- [x] 2.1 在 [app/(main)/checkin/page.tsx](../../../app/(main)/checkin/page.tsx) 新增狀態：`showProgress`（彈窗開關）、`progressData`（`MonthProgressCard` 所需資料，初始 `null`）、`progressLoading`
- [x] 2.2 新增 `loadProgressPopup()` 函式：呼叫 `GET /api/stats/dashboard`（不帶 `month`），成功則設定 `progressData` 並開啟彈窗；失敗則 toast 錯誤訊息，不開啟彈窗（不阻擋既有打卡成功流程）；用 `AbortController` 包裝，彈窗關閉時 abort 未完成的請求
- [x] 2.3 新增進度彈窗 JSX（複用既有 `Dialog`/`DialogContent`），`progressLoading` 時顯示 skeleton，`progressData` 到位後渲染 `<MonthProgressCard />`，提供關閉按鈕

## 3. 打卡頁：觸發時機與順序整合

- [x] 3.1 修改 `handleSubmit()` 的 POST（`!isEditing`）成功分支：若 `json.newAchievements?.length > 0`，維持現有成就佇列邏輯，但標記「成就播放完後需接著開進度彈窗」；若無成就，直接呼叫 `loadProgressPopup()`
- [x] 3.2 修改 `dismissAch()`：當 `achQueue` 清空（`next.length === 0`）且「待顯示進度彈窗」標記為真時，呼叫 `loadProgressPopup()` 並清除標記
- [x] 3.3 確認 PATCH（`isEditing`）成功分支完全不觸碰 `showProgress`/`loadProgressPopup`，維持現狀行為（toast + 既有成就對帳提示）— 已在該分支明確 `return`，未呼叫 `loadProgressPopup`
- [x] 3.4 `npx tsc --noEmit`、`npm run lint` 通過

## 4. 驗證

- [ ] 4.1 手動以 `npm run dev` 驗證：(a) 首次打卡成功且無新成就 → 直接顯示進度彈窗 (b) 首次打卡成功且解鎖 1-2 個成就 → 成就彈窗跑完後才顯示進度彈窗 (c) 修改今日打卡（PATCH）→ 不顯示進度彈窗，僅 toast — **dev server 已啟動於 http://localhost:3000，待使用者登入真實帳號驗證**
- [ ] 4.2 手動驗證進度彈窗內容與 `/dashboard` 頁月度進度卡一致（含三線折線圖、無上月/歷史資料時的降級顯示）— **待使用者於瀏覽器驗證**
- [ ] 4.3 手動驗證彈窗可正常關閉（關閉按鈕、點背景），關閉後不殘留 loading 狀態或重複觸發 — **待使用者於瀏覽器驗證**
- [ ] 4.4 手動驗證弱網路/API 失敗情境（可暫時改 API 回傳錯誤測試）：彈窗不開啟、toast 提示失敗、原本的「今日已打卡」確認卡不受影響 — **待使用者驗證**
