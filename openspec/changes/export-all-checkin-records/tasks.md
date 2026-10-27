# Tasks

## 1. 後端：`GET /api/admin/export-records`

- [x] 1.1 新建 `app/api/admin/export-records/route.ts`：`requireAdmin()` 守衛，解析可選 `startMonth`/`endMonth`（`YYYY-MM`）查詢參數
- [x] 1.2 查詢 `checkin_records`：若有 `startMonth`/`endMonth` 則用 `.gte(startMonth-01).lte(getMonthEnd(endMonth))` 過濾，否則查全表；依 `member_id, date` 排序
- [x] 1.3 批次查詢出現過的 `member_id` 對應的 `members(id, name)`，記憶體 join 補上姓名
- [x] 1.4 組 CSV：header 為「成員編號、姓名、日期」+ `TASKS` 的 8 個任務名稱 + 「base_score、punch_bonus、total_score、punch_streak、work_hours、note、run_minutes、run_km、submit_time」；8 項任務欄位輸出「是」/「否」
- [x] 1.5 透過 `csvRow`/`csvField` 輸出，UTF-8 BOM 開頭，`Content-Disposition: attachment; filename="golden-eight-records-<範圍或all>.csv"`
- [x] 1.6 `npx tsc --noEmit` 通過

## 2. 前端：管理後台觸發入口

- [x] 2.1 [app/(main)/admin/page.tsx](../../../app/(main)/admin/page.tsx) 「罰款總結」Tab header 新增「全部紀錄 CSV」按鈕（沿用既有 CSV 按鈕樣式），點擊觸發 `window.location.href = '/api/admin/export-records'`（不帶參數，匯出全部歷史；本次不做範圍選擇 UI，維持最小可用）
- [x] 2.2 `npx tsc --noEmit`、`npm run lint` 通過

## 3. 驗證

- [x] 3.1 手動以 `npm run dev` 驗證：管理員登入，點擊「全部紀錄 CSV」，確認下載的 CSV 用 Excel/文字編輯器開啟時 BOM 正確、中文不亂碼 — 使用者已驗收正常
- [x] 3.2 手動驗證 CSV 列數與 `checkin_records` 總筆數一致（可用既有唯讀查詢腳本或 Supabase SQL Editor 核對筆數）— 使用者已驗收正常
- [x] 3.3 手動驗證 `startMonth`/`endMonth` 參數：帶參數時只匯出範圍內的紀錄 — 使用者已驗收正常
- [x] 3.4 手動驗證非管理員帳號呼叫 `GET /api/admin/export-records` 回傳 403 — 已驗證未登入呼叫回傳 401（`requireAdmin()` 的 `getCurrentMember()` 層先擋下）；使用者驗收正常
- [x] 3.5 手動驗證既有 `GET /api/admin/export`（月結摘要匯出）行為不受影響 — 使用者已驗收正常
