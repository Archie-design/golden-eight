# sunrise-photo Specification

## Purpose
TBD - created by archiving change add-sunrise-photo. Update Purpose after archive.
## Requirements
### Requirement: 打卡時選填上傳日出照
系統 SHALL 於打卡頁提供選填的日出照上傳入口（破曉打拳項目附近）。上傳為選填，MUST NOT 成為打卡（8 項任務提交）的必要條件；上傳失敗 MUST 僅提示錯誤，MUST NOT 阻擋或回退打卡本身。一位成員一個打卡日對應至多一張日出照，重複上傳覆蓋前一張。

#### Scenario: 選填上傳成功
- **WHEN** 成員於打卡頁選擇日出照並上傳成功
- **THEN** 該照片與其當日打卡紀錄關聯，打卡不受影響

#### Scenario: 上傳失敗不影響打卡
- **WHEN** 日出照上傳失敗（網路／檔案過大／其他錯誤）
- **THEN** 系統提示上傳失敗，8 項任務打卡仍可正常提交／維持

#### Scenario: 重複上傳覆蓋
- **WHEN** 成員於同一打卡日再次上傳日出照
- **THEN** 新照片覆蓋該日舊照片（維持一日一張）

---

### Requirement: 上傳前壓縮
系統 MUST 於前端上傳前壓縮圖片：長邊縮至 ≤ 1280px、輸出 JPEG、目標約 200KB。壓縮後才上傳，以控制 Supabase 免費版 Storage 容量。原始超大檔（如手機 3–8MB 原圖）MUST NOT 直接上傳。

#### Scenario: 大圖壓縮後上傳
- **WHEN** 成員選擇一張數 MB 的手機原圖
- **THEN** 前端先縮至長邊 ≤ 1280px、JPEG ~200KB，再上傳壓縮後檔案

---

### Requirement: Storage 儲存與關聯
系統 SHALL 將日出照存於 Supabase Storage 的 public bucket，path 依 `{yearMonth}/{date}_{memberId}` 規則，並將 path 寫入該成員該日 `checkin_records.sunrise_photo_path`。寫入 Storage MUST 經 server 端（service-role），前端 MUST NOT 直接寫入 Storage。

#### Scenario: 上傳寫入 Storage 與 DB
- **WHEN** 上傳 API 收到壓縮後照片
- **THEN** 存入 Storage public bucket 對應 path，並更新該打卡紀錄的 sunrise_photo_path

---

### Requirement: 全體當日日出瀏覽
登入學員 SHALL 能瀏覽當日全體已上傳的日出照集合，於儀表板以登入後彈窗呈現。此為公開分享內容，任一登入學員皆可檢視。未登入者 MUST NOT 存取此集合。

#### Scenario: 登入學員看今日大家的日出
- **WHEN** 登入學員開啟「今日大家的日出」彈窗
- **THEN** 顯示當日全體已上傳的日出照

---

### Requirement: 儀表板日曆 hover 顯示自己當日照
儀表板為「我的打卡日曆」，故日曆某日的 hover 預覽 SHALL 顯示**該成員自己**當天上傳的日出照（非他人）。該日無自己上傳的照片時，MUST NOT 顯示照片預覽。

#### Scenario: hover 有照之日
- **WHEN** 滑鼠移到日曆上某個自己有上傳日出照的日期
- **THEN** 顯示自己當天的日出照預覽

#### Scenario: hover 無照之日
- **WHEN** 滑鼠移到自己當天未上傳照片的日期
- **THEN** 不顯示照片預覽

---

### Requirement: 三個月保留與自動清理
系統 MUST 保留日出照 12 週（約三個月），逾期自動刪除以控制免費版空間。每日 cron SHALL 刪除 12 週前的日出照——同時刪除 Storage 檔與清空對應 `checkin_records.sunrise_photo_path`。cron MUST 經 CRON_SECRET 授權，個別刪除失敗 MUST 記錄且不中斷其餘清理。

#### Scenario: 逾期照片被清除
- **WHEN** cron 執行且存在 12 週前的日出照
- **THEN** 刪除其 Storage 檔並清空該紀錄的 sunrise_photo_path

#### Scenario: 未逾期照片保留
- **WHEN** cron 執行，照片在 12 週保留期內
- **THEN** 保留，不刪除

#### Scenario: 未授權請求
- **WHEN** cron 端點收到未帶正確 CRON_SECRET 的請求
- **THEN** 回 401，不執行任何刪除

