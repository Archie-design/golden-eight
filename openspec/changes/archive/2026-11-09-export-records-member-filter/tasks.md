# Tasks

## 1. 後端：`memberIds` 篩選參數

- [x] 1.1 [app/api/admin/export-records/route.ts](../../../app/api/admin/export-records/route.ts) 解析可選 `memberIds` 查詢參數（逗號分隔，過濾空字串）
- [x] 1.2 `memberIds` 非空時，query builder 鏈上新增 `.in('member_id', memberIds)`；與既有 `startMonth`/`endMonth` 條件並存
- [x] 1.3 CSV 檔名（`rangeLabel`）同步反映是否有成員篩選（例如加上成員數量或 `filtered` 標記，避免跟全員匯出的檔名混淆）— 新增 `memberLabel`（如 `_2members`）附加在檔名後
- [x] 1.4 `npx tsc --noEmit` 通過

## 2. 前端：管理後台多選成員介面

- [x] 2.1 [app/(main)/admin/page.tsx](../../../app/(main)/admin/page.tsx) 「罰款總結」Tab header 新增成員篩選狀態（`exportMemberIds: Set<string>` 或陣列）
- [x] 2.2 新增成員晶片區塊：每位活躍成員一個可點擊切換的 checkbox + 姓名晶片，選中時視覺上明顯區分（邊框/背景變色）— 放在「罰款總結」CardContent 頂部
- [x] 2.3 `handleExportAllRecords` 組 URL 時，若有勾選成員則附加 `memberIds=` 查詢參數；未勾選任何成員時維持現有行為（不帶 `memberIds`）
- [x] 2.4 `npx tsc --noEmit`、`npm run lint` 通過 — 另跑 `npm run build`（webpack）確認可部署

## 3. 驗證

- [x] 3.1 手動以 `npm run dev` 驗證：未勾選任何成員，點擊匯出，確認下載的 CSV 含全員資料（與本次變更前行為一致）— 使用者已驗收正常
- [x] 3.2 手動驗證：勾選 1 位成員，點擊匯出，確認 CSV 僅含該成員資料 — 使用者已驗收正常
- [x] 3.3 手動驗證：勾選多位成員，點擊匯出，確認 CSV 僅含勾選成員的資料 — 使用者已驗收正常
- [x] 3.4 手動驗證：勾選成員 + 設定月份範圍（`startMonth`/`endMonth`）同時套用，確認兩個篩選條件皆生效 — 使用者已驗收正常
- [x] 3.5 手動驗證既有「罰款總結」月結摘要匯出（`GET /api/admin/export`）行為不受影響 — 使用者已驗收正常
