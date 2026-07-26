## Why

「丹氣跑步 15 分鐘」是每日 8 項任務之一，但目前只有布林勾選，學員無法記錄實際跑了多久、多遠，也看不到自己一個月累積的運動量。加上選填的分鐘數與公里數，並在儀表板呈現當月累積，讓學員看見自己的努力軌跡、獲得成就感與持續動力。與剛上線的日出照同一個模式（打卡完成後選填、不影響打卡節奏）。

## What Changes

- **打卡完成後**新增選填「慢跑記錄」：分鐘數（整數）與公里數（小數點後兩位）。與日出照一致，於**已完成打卡的卡片內**才出現輸入，MUST NOT 塞進打卡流程本身、不影響打卡節奏。
- **兩欄各自獨立選填**：只填分鐘、只填公里、兩者皆填、皆不填，皆可。
- **純記錄，不影響計分**：與「丹氣跑步」勾選脫鉤，不改 tasks[2] 完成判定、不改分數（與 work_hours 同模式）。
- **儀表板「本月慢跑累積」卡片**：顯示當月 Σ 分鐘、Σ 公里、有跑天數。
- 慢跑數據附著於當日打卡紀錄，一日一筆，重複輸入覆蓋。

不改 8 項打卡邏輯、計分、月結。無檔案上傳、無 Storage、無 cron（比日出照單純）。

## Capabilities

### New Capabilities
- `run-log`: 丹氣慢跑記錄的能力——涵蓋打卡完成後選填分鐘/公里（各自獨立）、純記錄不影響計分、附著於當日打卡、以及儀表板當月累積（總分鐘/總公里/天數）呈現。

### Modified Capabilities
<!-- 無：daily-checkin 既有 spec 未涵蓋慢跑量化記錄；本次為新增選填欄位與獨立能力，不改既有打卡規則。-->

## Impact

- **DB schema**：`checkin_records` 加兩欄 `run_minutes INT`、`run_km NUMERIC(6,2)`（皆 nullable）。migration 一支 + schema.sql 同步。
- **修改** `lib/validation.ts`：`CheckInSubmitSchema` 加 `run_minutes`（int ≥0 選填）、`run_km`（number ≥0、2 位小數選填）。
- **修改** `app/api/checkin/submit/route.ts`：POST/PATCH 寫入兩欄（沿用 work_hours 的選填數字寫入模式）。
- **修改** `app/api/checkin/today/route.ts`：回傳既有慢跑值（供完成卡片預填）。
- **修改** `app/(main)/checkin/page.tsx`：已完成打卡卡片內加慢跑輸入（分鐘/公里）+ 送出。
- **修改** `app/api/stats/dashboard/route.ts`：加當月慢跑累積（sumMinutes / sumKm / runDays）。
- **修改** `app/(main)/dashboard/page.tsx`：加「本月慢跑累積」卡片。
- **相依既有**：work_hours 的選填數字處理模式、CheckInRecord 型別、儀表板 monthRecs。
- 回滾：移除兩欄、schema/validation/UI 對應即可，無計分依賴。
