# Design

## Context

目前「早睡早起」用一個 checkbox + 一個「12 點前入睡」次選項（`early_sleep_half`）計分，資料庫與程式碼多處耦合（`lib/validation.ts`、`lib/scoring.ts`、`app/api/checkin/submit/route.ts` 的 POST/PATCH、`app/api/checkin/today/route.ts`、`app/(main)/checkin/page.tsx`）。「破曉打拳前置條件」是 `lib/validation.ts` 內一條獨立的 Zod refine，與計分邏輯無關，純粹擋提交。

跨午夜時間運算已有既定模式：`lib/sunrise.ts` 的 `addMinutes(hhmm, minutes)` 用 `% 1440` 正規化處理負數與跨日，本次新增的睡眠時數計算直接沿用同一模式，不另起爐灶。

見 proposal.md - Why / What Changes。

## Goals / Non-Goals

**Goals:**
- 移除破曉打拳↔早睡早起的提交期前置條件驗證。
- 早睡早起改為「入睡 23:00 前」+「睡眠時數 ≥ 6 小時」雙條件判定，兩者皆用使用者填入的入睡/起床時間計算，使用者不用自己換算時數。
- 新規則只套用於 2026-11-20（台北打卡邏輯日）起的提交與修改；此前既有紀錄不回溯重算。

**Non-Goals:**
- 不處理「建議入睡時間」顯示邏輯（`suggested-sleep-time` capability，獨立於本變更，顯示建議值而非收使用者輸入）。
- 不新增睡眠品質/午睡等延伸功能。
- 不刪除資料庫既有 `early_sleep_half` 欄位或回填歷史資料。
- 不變更破曉打拳（tasks[1]）自身的計分方式，只移除它對早睡早起的依賴。

## Decisions

**1. 時間欄位用兩個獨立 `HH:MM` 字串（`sleep_start`/`sleep_end`），不用 timestamp 或 duration 輸入**
- 理由：沿用 `lib/sunrise.ts` 既有 `HH:MM` 字串慣例與 `addMinutes` 的 mod-1440 運算模式；打卡本身没有精確日期概念（邏輯日非日曆日），用純時間字串比強求使用者輸入完整日期更符合實際填寫情境（使用者只會記得「幾點睡、幾點起」）。
- 考慮過的替代方案：要求輸入完整 datetime——使用者體感複雜度高，且打卡頁其他欄位均無此類輸入；捨棄。

**2. 睡眠時數計算：`(sleep_end - sleep_start + 1440) % 1440` 分鐘，跨午夜視為正常情況**
- 理由：入睡時間幾乎必然在 24:00 前、起床在次日，`sleep_end` 數值上小於 `sleep_start` 是常態而非例外，與 `addMinutes` 已處理的「跨午夜」語意一致。
- 邊界：若計算結果為 0（`sleep_start === sleep_end`）或超過 16 小時（明顯填寫錯誤），`calcBaseScore`／驗證層不特別阻擋提交，只是該任務判定為未達成（不足 6 小時或所有時數異常值都不給分）——維持「寬進嚴出」，不在提交路徑加額外錯誤擋使用者，只在資料缺失（完全沒填時間）才擋。

**3. 「入睡 23:00 前」判斷用 `sleep_start <= '23:00'`（字串比較，HH:MM 零填充後可直接字串序比較）**
- 理由：`HH:MM` 零填充字串在 00:00–23:59 範圍內字串序等於時間序，與專案現有 `date` 欄位（`YYYY-MM-DD`）字串比較的慣例一致，不需額外轉數字。
- 注意：23:00 本身算「11 點前」（`<=`），與原規則「11 點前入睡」的含意一致（原 1 分檔也是 23:00 前）。

**4. `early_sleep_half` 欄位與參數整個移除（而非改名重用）**
- 理由：0.5 分檔的語意（12 點前入睡）在新規則下不存在對應概念，继续保留欄位名稱只會誤導；資料庫欄位本身不刪（歷史資料相容），但 TypeScript 型別、Zod schema、API 參數全面移除，新路徑不寫入也不讀取。
- 新增 `sleep_start`、`sleep_end` 作為 `checkin_records` 新欄位（nullable，僅 `tasks[0]=true` 時有值）。

**5. 生效時間以程式碼部署時刻為準，不做「邏輯日判斷新舊規則」的雙軌邏輯**
- 理由：使用者已確認套用到今天（11/20）的邏輯日起；由於只有單一活躍成員（M001）且本次是未來提交的規則變更（不回溯重算歷史資料），直接部署新驗證/計分邏輯即等同於「今天起生效」——不需要額外的日期分支程式碼增加複雜度。
- 權衡：若部署時間晚於 11/20 中午，當天若已用舊規則打卡，則该筆歷史記錄維持舊計分（不重算），之後的修改（PATCH）才會套用新規則重新計算——此行為與「修改當日打卡」既有語意一致（使用現在的邏輯重算,而非凍結為提交當下的邏輯)。

## Risks / Trade-offs

- [風險] 使用者填入睡/起床時間時可能疏忽跨午夜（例如誤填 `sleep_end` 為同一日較早時刻），導致算出極短或極長睡眠時數 → 緩解：前端在使用者填完兩個欄位後即時顯示換算出的睡眠時數與是否達成，讓使用者在送出前自行核對，不在後端擋提交。
- [風險] 移除前置條件後，部分使用者可能誤以為兩項任務仍有關聯 → 緩解：更新打卡頁文案/說明，移除「需先完成早睡早起」提示。
- [取捨] 不回溯重算歷史資料，表示 11/20 之前的 `early_sleep_half` 0.5 分紀錄將永久保留在歷史月結、成就、連續天數統計中，與未來紀錄計分標準不一致——但這與專案既有「月結/成就為當下事實，不因規則變更重算」的原則（見 `daily-status-digest`、`monthly-settlement` 的 idempotent 設計）一致，不特別處理。

## Migration Plan

1. 資料庫新增 `checkin_records.sleep_start`、`sleep_end`（nullable `TEXT`，儲存 `HH:MM`）欄位（migration）。
2. `lib/scoring.ts`：新增睡眠時數判定函式，`calcBaseScore` 改签名為接收 `sleep_start`/`sleep_end` 取代 `earlySleepHalf`。
3. `lib/validation.ts`：移除破曉打拳前置條件 refine；移除 `early_sleep_half` schema 欄位，新增 `sleep_start`/`sleep_end`（勾選 tasks[0] 時必填的 refine）。
4. `app/api/checkin/submit/route.ts`（POST/PATCH）、`app/api/checkin/today/route.ts`：改讀寫新欄位。
5. `app/(main)/checkin/page.tsx`：UI 改為入睡/起床時間輸入框，移除「12 點前入睡」選項與相關顯示文案。
6. `lib/constants.ts`：`TASKS[0].desc` 文字更新。
7. 部署後不需回填歷史資料；不需額外的 feature flag 或雙軌切換。

無 rollback 特殊步驟——若需回退，revert 程式碼部署即可，資料庫新欄位允許為 null 不影響舊程式碼讀取（舊程式碼本就不讀這兩欄）。
