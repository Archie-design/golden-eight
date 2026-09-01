## Context

「丹氣跑步 15 分鐘」是 tasks[2]，目前僅布林勾選。要加選填的分鐘/公里量化記錄 + 儀表板當月累積。

現成範本：**`work_hours`** 是既有的選填數字欄位，走過完整鏈路——`CheckInSubmitSchema` 的 `z.number().min(0).max(24).optional()`、submit route 的 `typeof work_hours === 'number' ? work_hours : null` 寫入、`checkin_records.work_hours` 儲存。慢跑兩欄照抄此模式即可，風險低。

使用者確認：純記錄不影響計分、兩欄各自獨立選填、儀表板顯總分鐘/總公里/天數、**打卡完成後才出現輸入**（與日出照一致，於已完成卡片內，不影響打卡節奏）。

比日出照單純：無 Storage、無壓縮、無 cron，純 DB 欄位 + 表單 + 統計。

## Goals / Non-Goals

**Goals:**
- checkin_records 加 run_minutes / run_km，選填、各自獨立。
- 打卡完成後於完成卡片輸入，不影響打卡流程。
- 純記錄，與 tasks[2] 及計分脫鉤。
- 儀表板當月累積：Σ 分鐘、Σ 公里、有跑天數。

**Non-Goals:**
- 不改 tasks[2] 完成判定、計分、月結。
- 不做配速/圖表/歷史趨勢（本次只做當月累積數字；配速等可另議）。
- 不做日曆 hover 顯慢跑（本次以累積卡片為限）。
- 不與現有跑步成就（T3_STREAK_*）連動——那些看勾選，不看數字。

## Decisions

### 決策 1：兩欄型別 run_minutes INT、run_km NUMERIC(6,2)
- 分鐘為整數（`INT`）；公里保留兩位小數（`NUMERIC(6,2)`，上限 9999.99 足夠）。皆 nullable，未填為 NULL。migration 一支 + schema.sql 同步。

### 決策 2：validation 照 work_hours 模式
```
run_minutes: z.number().int().min(0).max(1440).optional()   // 一天最多 1440 分
run_km:      z.number().min(0).max(999.99)
              .refine(v => Number(v.toFixed(2)) === v || true) // 允許 2 位小數
              .optional()
```
- 上限防呆（分鐘 ≤1440、公里 ≤999.99）。公里數以 `Number(v.toFixed(2))` 於寫入時規範到 2 位。

### 決策 3：submit route 寫入（POST + PATCH 皆處理）
- 沿用 `typeof x === 'number' ? x : null`。慢跑既可隨打卡一起送、也可打卡後單獨 PATCH 補填。**因需求是「打卡完成後才輸入」**，前端在完成卡片以 PATCH（或既有編輯路徑）更新當日 run_minutes/run_km，不必重打整筆。實作採：完成卡片的慢跑送出走 PATCH `/api/checkin/submit`（既有 PATCH 支援部分欄位更新）或新增輕量 patch；優先複用既有 PATCH 以最小改動。

### 決策 4：儀表板當月累積
- dashboard route 由 monthRecs 聚合：`sumMinutes = Σ run_minutes`、`sumKm = Σ run_km`（保留 2 位）、`runDays = 有 run_minutes 或 run_km 非空的天數`。回 `runLog: { sumMinutes, sumKm, runDays }`。
- 前端加「本月慢跑累積」卡片，顯三個數字；無記錄顯 0。

### 決策 5：完成卡片 UI
- 於 checkin page 已完成卡片內（日出照上傳附近）加兩個 number input（分鐘、公里）+ 送出鈕。today route 回傳既有值供預填（重載後仍見）。與日出照並列，同屬「打卡後的附加記錄」區。

## Risks / Trade-offs

- **[公里小數精度]** JS 浮點加總可能有微誤差。→ 加總後 `Number(sum.toFixed(2))` 規範；DB NUMERIC(6,2) 本身精確。
- **[與 work_hours 的一致性]** 完全照 work_hours 模式，降低新錯誤面。
- **[PATCH vs 隨打卡送]** 需求要「打卡後才輸入」，故走完成卡片 PATCH。若使用者未打卡就想記慢跑——不支援（與日出照一致：附著於打卡）。
- **[成就連動]** 明確不連動 T3_STREAK_*（那些看勾選）。避免「填了數字卻沒勾跑步」的語意混淆——數字純附加。
- **[輸入驗證]** 上限防呆避免離譜值（如打錯成 10000 公里）。

## Migration Plan

- **DB migration**：`supabase/migrations/` 加 `ALTER TABLE checkin_records ADD COLUMN run_minutes INT, ADD COLUMN run_km NUMERIC(6,2);`，schema.sql 同步。
- **程式**：validation 加兩欄 → submit route 寫入 → today route 回傳 → checkin page 完成卡片輸入 → dashboard route 聚合 → dashboard page 累積卡片。
- **回滾**：移除兩欄與對應 UI/schema。無計分依賴，回滾安全。
- **上線前置**：Supabase SQL Editor 跑 migration（唯一手動步驟；無 bucket、無環境變數）。
- **驗證**：填分鐘/公里 → checkin_records 有值、分數不變、儀表板累積正確；只填一欄 OK；重填覆蓋。

## Open Questions

- 是否要顯「平均配速」（分鐘÷公里）——本次不做，累積數字為主；反饋後可加。
- 公里輸入用 step="0.01" 的 number input 是否好用（手機鍵盤）——實機看，必要時改文字+驗證。
- 是否納入跑步成就的進階版（如「本月累積 42km 全馬」徽章）——另案，非本次。
