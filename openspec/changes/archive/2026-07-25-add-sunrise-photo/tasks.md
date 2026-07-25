## 1. 前置：Storage bucket 與 DB 欄位

- [ ] 1.1 Supabase Console 建 public bucket `sunrise-photos`（public read 開啟）
- [x] 1.2 migration：`ALTER TABLE checkin_records ADD COLUMN sunrise_photo_path TEXT;`（`supabase/migrations/` 加一支）
- [x] 1.3 `supabase/schema.sql` 同步加該欄位
- [x] 1.4 更新 `types/index.ts` 的 `CheckInRecord`：加 `sunrise_photo_path?: string | null`

## 2. 前端壓縮（lib/image-compress.ts）

- [x] 2.1 新增 `compressImage(file, {maxEdge=1280, quality=0.8})`：`createImageBitmap`（`imageOrientation:'from-image'` 修 EXIF）→ canvas 等比 resize → `toBlob('image/jpeg')`
- [x] 2.2 目標 ~200KB；過大時二次降 quality（如 0.6）重壓
- [x] 2.3 回傳 Blob；非圖片檔或解碼失敗拋明確錯誤

## 3. 上傳 API（app/api/checkin/sunrise-photo/route.ts）

- [x] 3.1 `POST`：`getCurrentMember` 驗身分；收壓縮後檔 + 目標日期（預設當前邏輯日）
- [x] 3.2 要求該日已有 checkin_records（無則回提示「請先完成打卡再上傳」），維持照片附著於打卡
- [x] 3.3 以 service-role 上傳 Storage：path `{ym}/{date}_{memberId}.jpg`、`upsert:true`（重傳覆蓋）
- [x] 3.4 update 該列 `sunrise_photo_path`；回傳 public URL
- [x] 3.5 rate limit（沿用 `checkRateLimit`，如 10/min/IP）；檔案大小上限防呆

## 4. 打卡頁上傳 UI（app/(main)/checkin/page.tsx）

- [x] 4.1 破曉打拳附近加「上傳日出照」選填入口（file input，`accept=image/*capture`）
- [x] 4.2 選檔 → `compressImage` → 呼叫上傳 API；上傳中顯 loading
- [x] 4.3 失敗僅 toast 提示，MUST NOT 阻擋 8 項打卡提交（解耦）
- [x] 4.4 成功顯縮圖預覽 + 可重新上傳（覆蓋）

## 5. 今日全體彈窗（API + 儀表板）

- [x] 5.1 `GET /api/stats/sunrise-today?date=`：`getCurrentMember` 驗登入；撈當日非空 `sunrise_photo_path` + 成員名 → `[{name,url}]`（`getPublicUrl`）
- [x] 5.2 `app/(main)/dashboard/page.tsx`：加「今日大家的日出」按鈕 → 彈窗 grid 呈現

## 6. 儀表板日曆 hover 顯自己當日照

- [x] 6.1 `app/api/stats/dashboard/route.ts`：`calendar` 每格加 `sunrisePhotoUrl`（自己該日 path→getPublicUrl，無則 null）
- [x] 6.2 前端日曆格 hover（浮層或放大）顯示自己當天日出照；無照之日不顯

## 7. 三個月清理 cron

- [x] 7.1 `app/api/cron/sunrise-cleanup/route.ts`：CRON_SECRET 授權；cutoff=今日−12週；撈 `date < cutoff 且 path 非空` → `storage.remove(paths)` + `update path=null`；個別失敗記錄不中斷
- [x] 7.2 `vercel.json` 加每日 cron（台北 04:00 = UTC 20:00，離峰、與既有 cron 錯開）
- [x] 7.3 回傳清理筆數；無授權回 401

## 8. 驗證

- [x] 8.1 `npx tsc --noEmit` + `npm run lint` 通過
- [x] 8.2 `openspec validate add-sunrise-photo --strict` 通過
- [ ] 8.3 壓縮驗證：數 MB 圖 → 輸出 ≤ ~200KB、長邊 ≤ 1280、方向正確
- [ ] 8.4 端到端（部署後，bucket 建好）：上傳→Storage 有檔、日曆 hover 顯示、彈窗列出全體
- [ ] 8.5 上傳失敗不影響打卡（模擬失敗，8 項仍可提交）
- [ ] 8.6 cron：塞一筆 12 週前測試照 → 觸發 → 檔與 path 皆刪；未授權回 401
