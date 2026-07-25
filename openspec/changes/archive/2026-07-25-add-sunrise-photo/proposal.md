## Why

破曉打拳的精神是「早起見日出」。讓學員在打卡時選填上傳自己拍的日出照，能把抽象的打卡變成具體的成果分享，看見彼此的日出、互相激勵一起早起。目前打卡只有 8 個布林勾選，缺少這種情感連結與同儕鼓勵的元素。

## What Changes

- **打卡頁新增選填「上傳日出照」**：在破曉打拳項目附近提供上傳入口。選填——不影響打卡本身，上傳失敗只提示、不擋 8 項任務提交。
- **上傳前壓縮**（免費版空間關鍵）：前端以 Canvas 將圖縮至長邊 ≤ 1280px、輸出 JPEG ~200KB，再上傳。避免手機原圖 3–8MB 一個月內撐爆 Supabase 免費版 1GB。
- **儲存於 Supabase Storage**（首次使用 Storage）：**public bucket**，一張日出照對應一位成員的一個打卡日；path 存入 `checkin_records.sunrise_photo_path`。
- **全體學員可見**（登入後）：登入學員可瀏覽「今日大家的日出」——於儀表板以登入後彈窗呈現公開的當日日出照集合。
- **儀表板日曆 hover 預覽**：滑鼠移到日曆某日 → 顯示**該成員自己**當天上傳的日出照（我的打卡日曆，故顯自己的）。
- **保留三個月、自動清理**：新增每日 cron，刪除 12 週前的日出照（Storage 檔 + 清空 DB path），控制免費版空間。

不改計分、不改打卡的 8 項邏輯與月結。

## Capabilities

### New Capabilities
- `sunrise-photo`: 日出照上傳與分享的能力——涵蓋打卡時選填上傳、前端壓縮、Supabase Storage（public bucket）儲存與 path 關聯、全體當日日出瀏覽、儀表板日曆 hover 顯示自己當日照、以及三個月保留期的每日 cron 清理。

### Modified Capabilities
<!-- 無：daily-checkin 既有 spec 未涵蓋照片；本次為新增選填欄位與獨立能力，不改既有 8 項打卡規則。-->

## Impact

- **Storage（新）**：Supabase 建 public bucket `sunrise-photos`；path 規則 `{yearMonth}/{date}_{memberId}.jpg`。RLS/policy：public read；寫入僅經 service-role server 端（前端不直接寫，走 API）。
- **DB schema**：`checkin_records` 加欄位 `sunrise_photo_path TEXT`（nullable）。migration 一支。
- **新增** `lib/image-compress.ts`（前端 Canvas 壓縮：resize + toBlob JPEG）。
- **新增** `app/api/checkin/sunrise-photo/route.ts`（POST 上傳：驗身分 → 存 Storage → 寫 path；與打卡提交解耦，可獨立呼叫）。
- **新增** `app/api/stats/sunrise-today/route.ts`（GET 今日全體日出照，供彈窗）。
- **修改** `app/api/stats/dashboard/route.ts`：日曆每格加 `sunrisePhotoUrl`（自己該日）。
- **修改** `app/(main)/checkin/page.tsx`：破曉打拳附近加上傳 UI + 壓縮 + 呼叫上傳 API。
- **修改** `app/(main)/dashboard/page.tsx`：日曆 hover 顯照 + 「今日大家的日出」彈窗。
- **新增** `app/api/cron/sunrise-cleanup/route.ts` + `vercel.json` 加一支每日 cron（刪 12 週前）。
- **環境變數**：復用既有 `SUPABASE_SERVICE_ROLE_KEY`、`NEXT_PUBLIC_SUPABASE_URL`、`CRON_SECRET`；不需新增。
- 回滾：移除 bucket/欄位/route/cron 即可；照片為附加內容，無計分依賴。
