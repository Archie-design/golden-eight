## Why

「破曉打拳」要求成員在日出後早起運動，其前提是前一晚有正常入睡。若成員未完成「早睡早起（子時入睡）」卻打卡「破曉打拳」，在習慣養成的邏輯上自相矛盾。目前打卡提交對 8 項任務各自獨立，沒有任何跨任務的前置條件約束，使這種不合理組合得以成立。本變更加入一道驗證規則，確保打拳建立在早睡的基礎上。

## What Changes

- 打卡提交新增前置條件驗證：當 `tasks[1]`（破曉打拳）為 true 時，`tasks[0]`（早睡早起／子時入睡）MUST 也為 true，否則拒絕提交。
- 規則同時套用於 `POST /api/checkin/submit`（新增打卡）與 `PATCH /api/checkin/submit`（修改今日打卡）兩條路徑。
- 後端透過 `CheckInSubmitSchema` 的跨欄位驗證強制執行，回傳 400 與中文錯誤訊息。
- 前端 `handleSubmit` 在送出前先行攔截並提示，避免無謂的請求往返。
- 不影響計分、`punch_streak`、成就計算邏輯；不變更資料庫 schema；不回溯歷史資料。

## Capabilities

### New Capabilities
<!-- 無新增 capability。 -->

### Modified Capabilities
- `daily-checkin`: 在「提交打卡」與「修改當日打卡」的需求中，新增「破曉打拳前置條件：須同時完成早睡早起」這條跨任務驗證規則。

## Impact

- **驗證層**：`lib/validation.ts` 的 `CheckInSubmitSchema` 加上跨欄位 `.refine()`（型別由 `ZodObject` 變 `ZodEffects`）。
- **API**：`app/api/checkin/submit/route.ts` 的 POST 與 PATCH 透過既有 `parseBody` 自動套用，無需各自重複邏輯。
- **前端**：`app/(main)/checkin/page.tsx` 的 `handleSubmit` 加一道送出前檢查。
- **行為變更**：對既有合法打卡組合無影響；僅新增一種被拒絕的非法組合（有打拳、無早睡）。
- **不影響**：計分函式、成就系統、資料庫 schema、歷史紀錄。
