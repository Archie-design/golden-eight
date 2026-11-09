# Tasks

## 1. 後端：`calendar[]` 新增 tasks 欄位

- [x] 1.1 [app/api/stats/dashboard/route.ts](../../../app/api/stats/dashboard/route.ts) 組 `calendar[]` 的迴圈中新增 `tasks: rec?.tasks ?? null`
- [x] 1.2 `npx tsc --noEmit` 通過

## 2. 前端：`CalendarGrid` 放寬點擊條件並顯示任務明細

- [x] 2.1 `CalendarDay` 介面新增 `tasks: boolean[] | null`
- [x] 2.2 `handleClick` 移除「無 note 則不展開」的提前返回，改為任一天皆可點擊切換展開/收合
- [x] 2.3 展開面板新增 8 項任務小方塊顯示（比照 `app/(main)/admin/page.tsx` 個人逐日明細表既有的 `TASK_ABBR` 視覺語彙：完成實心＋✓、未完成灰色＋·），使用 `lib/constants.ts` 的 `TASKS` 取得任務名稱；僅在 `tasks !== null` 時顯示
- [x] 2.4 `tasks === null` 且非請假時，面板顯示「當日未打卡」提示文字
- [x] 2.5 既有備註、請假事由顯示邏輯（`noteFor`）維持不變，與任務方塊並存於同一面板
- [x] 2.6 格子本身的 `cursor-pointer` 樣式同步放寬為任一天皆適用（不再僅限 `hasNote || hasPhoto`）

## 3. 前端：型別同步

- [x] 3.1 [app/(main)/dashboard/page.tsx](../../../app/(main)/dashboard/page.tsx) 的 `DashboardData.calendar` 型別新增 `tasks: boolean[] | null`
- [x] 3.2 `npx tsc --noEmit`、`npm run lint` 通過

## 4. 驗證

- [ ] 4.1 手動以 `npm run dev` 驗證：點擊已打卡的日子，確認 8 項任務完成狀態正確顯示（與打卡頁實際勾選一致）— **dev server 已啟動於 http://localhost:3000，待使用者登入真實帳號驗證**
- [ ] 4.2 手動驗證點擊未打卡日子，顯示「當日未打卡」而非空白或全部未完成的誤導清單 — **待使用者驗證**
- [ ] 4.3 手動驗證請假日點擊後，既有請假事由顯示不受影響 — **待使用者驗證**
- [ ] 4.4 手動驗證有備註的日子，備註與任務方塊同時顯示，排版正常 — **待使用者驗證**
