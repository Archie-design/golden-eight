# Tasks

## 1. 資料庫

- [x] 1.1 新增 migration：`checkin_records` 新增 `sleep_start TEXT`、`sleep_end TEXT`（nullable），驗證：`supabase/migrations/` 新檔可於 SQL Editor 執行成功，`early_sleep_half` 欄位不變動

## 2. `lib/scoring.ts`：計分邏輯改寫

- [x] 2.1 新增睡眠時數判定函式（輸入 `sleep_start`/`sleep_end` HH:MM 字串，輸出是否同時滿足「23:00 前入睡」與「睡滿 6 小時」），沿用 `lib/sunrise.ts` 的 mod-1440 跨午夜運算模式；驗證：針對 22:30→05:00（達成）、22:50→03:30（時數不足）、23:30→06:00（入睡太晚）三組情境手動驗證輸出符合預期
- [x] 2.2 `calcBaseScore` 簽章改為接收 `sleep_start?`/`sleep_end?` 取代 `earlySleepHalf`，`tasks[0]` 的計分改用 2.1 判定函式（滿足兩條件得 1 分，否則 0 分）；移除 0.5 分邏輯；驗證：`npx tsc --noEmit` 通過，且既有呼叫 `calcBaseScore` 的測試情境（若有）更新後仍一致

## 3. `lib/validation.ts`：驗證規則調整

- [x] 3.1 移除 `tasks[1] → tasks[0]` 前置條件 refine 與其中文錯誤訊息；驗證：`tasks = [false, true, ...]`（早睡早起未完成但破曉打拳完成）通過 schema 驗證
- [x] 3.2 移除 `early_sleep_half` 欄位；新增 `sleep_start`/`sleep_end`（`HH:MM` 格式字串，optional），並新增 refine：`tasks[0] === true` 時 `sleep_start`、`sleep_end` 皆為必填；驗證：`tasks[0]=true` 且缺少任一時間欄位時驗證失敗並給出中文錯誤訊息

## 4. `app/api/checkin/submit/route.ts`：串接新欄位

- [x] 4.1 POST handler：解構 `sleep_start`/`sleep_end` 取代 `early_sleep_half`，傳入 `calcBaseScore`，寫入 `checkin_records.sleep_start`/`sleep_end`（不再寫 `early_sleep_half`）；驗證：`npx tsc --noEmit` 通過
- [x] 4.2 PATCH handler：同步調整（解構、計分、寫入欄位一致）；驗證：手動以 PATCH 修改睡眠時間觀察分數重算、成就對帳行為符合 design.md 的「修改打卡調整睡眠時間改變早睡早起判定」情境 — 程式邏輯已核對符合（重算路徑與 POST 共用 `calcBaseScore`/判定函式），尚待使用者實際以 PATCH 操作一次確認

## 5. `app/api/checkin/today/route.ts`：讀取新欄位

- [x] 5.1 查詢欄位改為包含 `sleep_start`、`sleep_end`，移除 `early_sleep_half`；回應物件同步調整；驗證：`npx tsc --noEmit` 通過

## 6. `app/(main)/checkin/page.tsx`：UI 調整

- [x] 6.1 移除「12 點前入睡」checkbox/選項與其 0.5 分顯示文案；新增勾選「早睡早起」時顯示的「入睡時間」「起床時間」兩個時間輸入欄位
- [x] 6.2 前端即時計算並顯示換算出的睡眠時數與是否達成兩條件（23:00 前 + 滿 6 小時），讓使用者送出前自行核對；驗證：於瀏覽器手動測試三組時間組合（達成／時數不足／入睡過晚），顯示結果符合預期 — 判定函式已用 Node 腳本驗證三組情境皆正確；本次環境無瀏覽器自動化工具，實際畫面顯示待使用者於瀏覽器開啟打卡頁確認
- [x] 6.3 移除「破曉打拳需先完成早睡早起」相關提示文案（若頁面原有說明文字）；驗證：勾選破曉打拳但不勾早睡早起可直接送出不被擋

## 7. `lib/constants.ts`：文案更新

- [x] 7.1 `TASKS[0].desc` 改為反映新規則（例如「11 點前入睡，且睡滿 6 小時才算達成」）；驗證：打卡頁顯示的任務說明文字已更新

## 8. 整體驗證

- [x] 8.1 `npm run lint` 通過（1 個與本次變更無關的既有 `<img>` 警告，0 錯誤）
- [x] 8.2 `npm run build`（webpack，避開已知 Turbopack 中文路徑 bug）確認可部署
- [x] 8.3 手動驗證完整流程：勾選破曉打拳、不勾早睡早起 → 可成功提交且破曉打拳計 1 分；勾選早睡早起並填入睡 22:30/起床 05:00 → 早睡早起計 1 分；勾選早睡早起但只填入睡時間（未填起床時間）→ 提交被拒並提示補填 — 以 Node 腳本重現 Zod schema 與計分函式驗證三組情境皆符合預期；**實際登入打卡頁的操作驗證待使用者於瀏覽器上線後確認**
