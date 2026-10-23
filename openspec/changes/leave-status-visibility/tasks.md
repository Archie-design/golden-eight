# Tasks

## 1. `lib/leave.ts`：新增含事由的查詢函式

- [x] 1.1 新增 `fetchLeaveRecords(db, memberIds, yearMonth)`：回傳 `Record<memberId, Map<date, reason>>`（查詢 `leave_records` 的 `member_id, date, reason`，與既有 `fetchLeaveDates` 相同的月份範圍邏輯）
- [x] 1.2 將既有 `fetchLeaveDates` 改為內部呼叫 `fetchLeaveRecords` 並取 key 集合包成 `Set<string>`，確保兩者資料來源一致、不重複查詢邏輯
- [x] 1.3 `npx tsc --noEmit` 通過，確認既有呼叫端（`dashboard/route.ts`、`admin/penalty/route.ts`）行為不受影響

## 2. `GET /api/stats/dashboard`：calendar[] 新增請假標記

- [x] 2.1 改用 `fetchLeaveRecords` 取代目前的 `fetchLeaveDates` 呼叫，組 `calendar[]` 時依日期查 Map，設定 `isLeave: boolean` 與 `leaveReason: string | null`
- [x] 2.2 確認既有分母計算（`calcMonthStats` 呼叫）維持不變，只是改用同一份查詢結果的另一種讀法
- [x] 2.3 `npx tsc --noEmit` 通過

## 3. `components/CalendarGrid.tsx`：請假日獨立樣式

- [x] 3.1 `lib/constants.ts` 的 `CALENDAR_COLORS` 新增 `leave` token（與既有 none/low/mid/good/gold 五色皆可區分的配色）
- [x] 3.2 `CalendarGrid` 的 `CalendarDay` 介面新增 `isLeave?: boolean`；渲染時 `isLeave` 為真時套用 `leave` 樣式，優先於既有 `color` 欄位
- [x] 3.3 請假事由透過既有 `note` 欄位與既有點擊顯示備註面板機制呈現（例如傳入 `note: '請假：' + leaveReason`），不新增互動機制 — 實作為 `noteFor()` helper 合併請假事由與既有 note
- [x] 3.4 更新 `CalendarGrid` 頂部圖例，新增「請假」色塊說明
- [x] 3.5 [app/(main)/dashboard/page.tsx](../../../app/(main)/dashboard/page.tsx) 把 API 回傳的 `isLeave`/`leaveReason` 傳入 `CalendarGrid` — `data.calendar` 整包傳入，型別已含新欄位

## 4. `GET /api/admin/member-records`：回傳請假集合

- [x] 4.1 新增呼叫 `fetchLeaveRecords(db, [memberId], yearMonth)`，回應新增 `leaveByDate: Record<string, string>`（日期 → 事由）
- [x] 4.2 `npx tsc --noEmit` 通過

## 5. 管理後台個人逐日明細表：顯示請假列 + 修正累計率分母

- [x] 5.1 [app/(main)/admin/page.tsx](../../../app/(main)/admin/page.tsx) 的 `rows` 計算邏輯：請假日（`leaveByDate` 有該日期）SHALL 跳過分子分母累加（如同該日不存在），比照 `calcMonthStats` 的「分子分母皆移」原則 — 以 `countedDays` 取代 `(i+1)` 當分母累加基準
- [x] 5.2 表格請假列顯示「請假（事由）」樣式，取代目前的「（無記錄）」
- [x] 5.3 表尾「目前：totalScore / maxScore = rate%」同步反映扣除請假天數後的正確分母 — `maxScore = countedDays * 8`
- [ ] 5.4 手動驗證：挑一位本月有請假紀錄的成員（例如高珮綺 10/18–20），比對此表累計率與儀表板累計率是否一致 — **dev server 已啟動於 http://localhost:3000，待使用者於管理後台驗證**
- [x] 5.5 `npx tsc --noEmit`、`npm run lint` 通過

## 6. 驗證

- [ ] 6.1 手動以 `npm run dev` 驗證儀表板月曆：有請假日的成員登入，確認請假日顯示獨立樣式（非灰色），點擊/hover 可看到事由 — **待使用者驗證**
- [ ] 6.2 手動驗證未請假的「未報」日仍維持原本灰色，與請假日視覺可區分 — **待使用者驗證**
- [ ] 6.3 手動驗證管理後台個人逐日明細表：請假列顯示「請假（事由）」，累計率數字與儀表板一致 — **待使用者驗證**
- [ ] 6.4 手動驗證無請假紀錄的成員，兩處畫面行為與改動前一致（不受影響）— **待使用者驗證**
