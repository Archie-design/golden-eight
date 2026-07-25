## Context

打卡目前是 `checkin_records` 一筆 insert（8 布林 tasks + note + work_hours）。專案**從未使用 Supabase Storage**（grep 無 storage/upload/getPublicUrl），故本功能是 Storage 的首次引入。前端已有 html-to-image（截圖用），但壓縮任意上傳圖需自寫 Canvas。儀表板日曆 `calendar` 陣列每格 `{date, day, score, color, note}`，hover 顯照掛在此。

免費版 Supabase 硬限制：Storage 1GB 總量、單檔 50MB、每月 2GB 流量。手機日出原圖 3–8MB → 不壓縮 20 人×30 天≈600 張一個月內爆。**壓縮是這功能可行的前提**：壓到 ~200KB，20 人×90 天≈1800 張 ≈ 360MB，安全。

使用者確認的範圍：打卡選填上傳 → 全體當日可見（登入後彈窗）→ 日曆 hover 顯**自己**當日照 → 三個月 cron 清理。上傳失敗不影響打卡。

## Goals / Non-Goals

**Goals:**
- 打卡頁選填上傳日出照，前端壓縮後上傳，與打卡解耦（失敗不擋打卡）。
- public bucket 儲存 + path 存 `checkin_records.sunrise_photo_path`。
- 登入學員看「今日大家的日出」彈窗；日曆 hover 顯自己當日照。
- 每日 cron 刪 12 週前（Storage + DB path）。

**Non-Goals:**
- 不做公開日出相簿牆（獨立頁）——本次以彈窗 + 日曆 hover 為限。
- 不做讚／留言／檢舉等社群互動。
- 不改計分、8 項打卡邏輯、月結。
- 不做多張／相簿（一日一張，覆蓋）。
- 不做私人相簿（採 public，符合「互相鼓勵」）。

## Decisions

### 決策 1：public bucket，寫入走 server（service-role）
- bucket `sunrise-photos` 設 public read（`getPublicUrl` 直接取用，免簽名，最簡）。**寫入不開放前端直寫**——前端把壓縮後 blob 送到 `POST /api/checkin/sunrise-photo`，由 server 以 service-role 上傳。避免前端持有寫入權、也統一驗身分。
- path：`{yearMonth}/{date}_{memberId}.jpg`（如 `2026-07/2026-07-18_M001.jpg`）。以月分目錄便於 cron 掃描與人眼排查；固定檔名使「重複上傳覆蓋」天然成立（`upsert: true`）。

### 決策 2：前端 Canvas 壓縮（lib/image-compress.ts）
- `compressImage(file, { maxEdge: 1280, quality: 0.8 }): Promise<Blob>`：`createImageBitmap` → canvas resize（等比，長邊≤1280）→ `canvas.toBlob('image/jpeg', quality)`。目標 ~200KB；必要時二次降 quality。純前端、無依賴（不引入 library）。
- EXIF 方向：手機直拍常帶旋轉，`createImageBitmap(file, { imageOrientation: 'from-image' })` 修正，避免存進去躺平。

### 決策 3：上傳與打卡解耦
- 獨立 `POST /api/checkin/sunrise-photo`（body：壓縮後檔 + 目標日期）。前端在打卡頁可「先打卡、後傳照」或「只傳照」，互不阻擋。上傳成功才寫 `sunrise_photo_path`。
- 若該日尚無 checkin_records（先傳照後打卡的情況）：以 `date+member` upsert path，或要求先打卡再傳照——採「該日有紀錄才寫 path，無則僅存 Storage 待打卡後補關聯」過於複雜；**簡化為：上傳 API 內對該日 checkin_records 做 update path，若無列則一併 insert 一筆最小列或提示先打卡**。實作採「照片附著於打卡」語意：無當日打卡則回提示「請先完成打卡再上傳」，保持資料一致。

### 決策 4：schema 加 sunrise_photo_path
- `ALTER TABLE checkin_records ADD COLUMN sunrise_photo_path TEXT`（nullable）。migration 一支 + schema.sql 同步。既有列 NULL，無回填。

### 決策 5：日曆 hover 顯自己當日照
- dashboard route 的 `calendar` 每格加 `sunrisePhotoUrl`：由該成員該日 `sunrise_photo_path` 經 `getPublicUrl` 組出（有則 URL、無則 null）。前端 hover（title 或浮層）顯示。因儀表板是「我的日曆」，故顯自己的，語意一致。

### 決策 6：今日全體彈窗（stats/sunrise-today）
- `GET /api/stats/sunrise-today?date=`：撈當日所有非空 `sunrise_photo_path` + 成員名，回 `[{name, url}]`。前端儀表板一顆按鈕開彈窗，grid 呈現。僅登入可呼叫（`getCurrentMember`）。

### 決策 7：三個月清理 cron
- `GET /api/cron/sunrise-cleanup`（CRON_SECRET 授權）：算 cutoff = 今日 −12 週；撈 `sunrise_photo_path` 非空且 `date < cutoff` 的列 → `storage.remove([paths])` 批次刪 + `update sunrise_photo_path = null`。個別失敗記錄不中斷。vercel.json 加每日排程（避開 12:00 邊界，排 UTC 20:00 = 台北 04:00，離峰）。

## Risks / Trade-offs

- **[免費版容量爆掉]** 核心風險。→ 壓縮到 ~200KB（決策 2）+ 三個月清理（決策 7）+ 一日一張覆蓋。估算 360MB 遠低於 1GB。上線後可監控實際用量。
- **[public bucket 隱私]** 日出照 public read → 有 URL 即可看（免登入直連）。使用者已選「全體可見」，日出照非敏感，可接受。但 path 含 memberId，屬可預測——非機密內容，風險低；若在意可改隨機檔名（本次採可讀 path 便於維運）。
- **[前端直傳 vs server 中轉]** server 中轉多一跳、佔 function 時間，但換得不暴露寫入權 + 統一驗身分 + 統一壓縮驗證。壓縮後 200KB，中轉負擔小。
- **[EXIF 旋轉]** 手機直拍照躺平。→ `imageOrientation: 'from-image'` 修正，實測確認。
- **[先傳照後打卡的競態]** → 簡化為「需先有當日打卡才可上傳」（決策 3），避免孤兒照片與關聯複雜度。
- **[cron 刪除與上傳競態]** cron 刪 12 週前、上傳寫今日，時間窗不重疊，無競態。
- **[流量 2GB/月]** 彈窗一次載入全體當日縮圖（~200KB×20≈4MB/次），日曆 hover 才載入。20 人×每天數次瀏覽仍遠低於 2GB。若成長再議 CDN／快取。

## Migration Plan

- **手動前置（Supabase Console）**：建 public bucket `sunrise-photos`（public read on；不需自訂 policy，service-role 寫入繞過 RLS）。
- **DB migration**：`supabase/migrations/` 加一支 `ALTER TABLE checkin_records ADD COLUMN sunrise_photo_path TEXT;`，schema.sql 同步。
- **程式**：新增 image-compress / 3 個 route（upload/sunrise-today/cron）/ 改 checkin page + dashboard page + dashboard route；vercel.json 加 cron。
- **回滾**：移除欄位、route、cron、bucket。照片為附加內容，無計分依賴，回滾安全。
- **上線驗證**：上傳一張 → Storage 有壓縮後檔、日曆 hover 顯示、彈窗列出、cron 手動觸發刪 12 週前（可先塞測試舊資料）。

## Open Questions

- path 用可讀（含 memberId）vs 隨機 UUID——本次採可讀便於維運；若日後在意「猜 URL 看他人照」再改。
- 壓縮目標 200KB / 1280px 是否夠清晰——實機看日出照質感再微調。
- 「今日大家的日出」是否要顯示成員名——預設顯名（鼓勵性質）；若要匿名再調。
- cron 排程時間（本設台北 04:00 離峰）——與 daily-digest（12:30）、settlement（13:00）錯開即可。
