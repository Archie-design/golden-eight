## 1. 計算函式（lib/sunrise.ts）

- [x] 1.1 新增常數 `SLEEP_BUFFER_MIN = 20`、`SLEEP_HOURS = 6`（避免 magic number）
- [x] 1.2 新增 `getSuggestedSleepTime(dateStr)` = `addMinutes(await getPunchStartTime(dateStr), -(SLEEP_BUFFER_MIN + SLEEP_HOURS*60))`（−380 分）
- [x] 1.3 確認 `addMinutes` 負數 wrap 正確（05:25 → 23:05）

## 2. API 回傳（app/api/checkin/today/route.ts）

- [x] 2.1 呼叫 `getSuggestedSleepTime` 並於回傳新增 `suggestedSleep`（時間字串）
- [x] 2.2 確認既有 `sunrise`、`punchStart` 欄位不變

## 3. 前端顯示（app/(main)/checkin/page.tsx）

- [x] 3.1 型別新增 `suggestedSleep: string`
- [x] 3.2 於 L234「建議開始打拳時間為 {punchStart}」後，接顯「建議前一晚 {suggestedSleep} 前入睡」
- [x] 3.3 「前一晚」字樣明確（固定前綴，因入睡恆為前一晚）

## 4. 驗證

- [x] 4.1 `npx tsc --noEmit` + `npm run lint` 通過
- [x] 4.2 `openspec validate add-suggested-sleep-time --strict` 通過
- [x] 4.3 單元驗證：`getSuggestedSleepTime` 對日出 05:13（打拳 05:25）→ 入睡 23:05；跨午夜 wrap 正確；日出 fallback 06:00 → 打拳 06:12 → 入睡 23:52
- [ ] 4.4 手動：打卡頁顯示「本日日出 … 建議 … 打拳｜建議前一晚 HH:MM 前入睡」，時間正確且標明前一晚
