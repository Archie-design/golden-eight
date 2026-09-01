## 1. DB 欄位

- [x] 1.1 migration：`ALTER TABLE checkin_records ADD COLUMN run_minutes INT, ADD COLUMN run_km NUMERIC(6,2);`（`supabase/migrations/` 加一支）
- [x] 1.2 `supabase/schema.sql` 同步加兩欄
- [x] 1.3 `types/index.ts` 的 `CheckInRecord` 加 `run_minutes?: number | null`、`run_km?: number | null`

## 2. Validation（lib/validation.ts）

- [x] 2.1 `CheckInSubmitSchema` 加 `run_minutes: z.number().int().min(0).max(1440).optional()`
- [x] 2.2 加 `run_km: z.number().min(0).max(999.99).optional()`（寫入時規範 2 位小數）

## 3. Submit route 寫入（app/api/checkin/submit/route.ts）

- [x] 3.1 POST：解構 run_minutes/run_km，沿用 `typeof x==='number' ? x : null` 寫入 insert
- [x] 3.2 公里數寫入前 `Number(v.toFixed(2))` 規範 2 位小數
- [x] 3.3 PATCH（編輯/補填）：同樣支援更新 run_minutes/run_km（打卡後補填走此路徑）
- [x] 3.4 確認 tasks[2] 完成判定與 base_score/total_score 不因慢跑數據改變（純記錄）

## 4. Today route 回傳（app/api/checkin/today/route.ts）

- [x] 4.1 todayRec select 加 run_minutes、run_km
- [x] 4.2 回傳 todayRecord 含 run_minutes/run_km，供完成卡片預填

## 5. 打卡完成卡片輸入（app/(main)/checkin/page.tsx）

- [x] 5.1 已完成卡片內（日出照附近）加分鐘 number input + 公里 number input（step 0.01）
- [x] 5.2 兩欄各自獨立選填；預填 today route 回的既有值
- [x] 5.3 送出：以 PATCH 更新當日 run_minutes/run_km；成功 toast、失敗 toast，不影響打卡
- [x] 5.4 不出現在打卡流程本身（僅已完成狀態顯示）

## 6. 儀表板當月累積（API + 前端）

- [x] 6.1 `app/api/stats/dashboard/route.ts`：monthRecs 聚合 `runLog: { sumMinutes, sumKm, runDays }`（sumKm 保留 2 位）
- [x] 6.2 `app/(main)/dashboard/page.tsx`：加「本月慢跑累積」卡片顯總分鐘/總公里/有跑天數；無記錄顯 0

## 7. 驗證

- [x] 7.1 `npx tsc --noEmit` + `npm run lint` 通過
- [x] 7.2 `openspec validate add-run-log --strict` 通過
- [x] 7.3 邏輯驗證：只填分鐘 / 只填公里 / 兩者 / 皆不填 皆正確；公里 2 位小數；累積加總正確（含浮點規範）
- [x] 7.4 確認填慢跑不改分數、不改 tasks[2]（純記錄）
- [ ] 7.5 手動（部署 + migration 後）：完成卡片填慢跑→儀表板累積正確；重填覆蓋；不影響打卡節奏
