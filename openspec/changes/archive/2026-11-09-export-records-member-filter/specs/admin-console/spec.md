# Spec Delta

## MODIFIED Requirements

### Requirement: 全員打卡明細匯出
`GET /api/admin/export-records`（admin 限定）SHALL 匯出全員跨月份的逐日打卡明細 CSV。系統 MUST 接受可選查詢參數 `startMonth`、`endMonth`（皆為 `YYYY-MM` 格式）限定匯出範圍；省略任一或兩者時，MUST 匯出該成員全部歷史紀錄（不設時間下限/上限）。

系統 MUST 另接受可選查詢參數 `memberIds`（逗號分隔的成員編號清單，例如 `M001,M003`）限定匯出對象；省略時 MUST 匯出全部成員（與既有行為一致）。`memberIds` 篩選 MUST 可與 `startMonth`/`endMonth` 同時套用。

#### Scenario: 匯出全部歷史
- **WHEN** 管理員呼叫 `GET /api/admin/export-records`（不帶 `startMonth`/`endMonth`）
- **THEN** 回傳 CSV 含所有成員的所有歷史打卡紀錄，每列一筆 `checkin_records`

#### Scenario: 匯出指定月份範圍
- **WHEN** 管理員呼叫 `GET /api/admin/export-records?startMonth=2026-04&endMonth=2026-06`
- **THEN** 回傳 CSV 僅含 2026-04-01 至 2026-06-30（含）之間的打卡紀錄

#### Scenario: 非管理員存取
- **WHEN** 非管理員成員呼叫 `GET /api/admin/export-records`
- **THEN** 回傳 403（`requireAdmin()` 守衛，與其餘 `/api/admin/*` 路由一致）

#### Scenario: 匯出指定成員
- **WHEN** 管理員呼叫 `GET /api/admin/export-records?memberIds=M001`
- **THEN** 回傳 CSV 僅含 M001 的打卡紀錄

#### Scenario: 匯出指定成員 + 指定月份範圍
- **WHEN** 管理員呼叫 `GET /api/admin/export-records?memberIds=M001,M003&startMonth=2026-10&endMonth=2026-11`
- **THEN** 回傳 CSV 僅含 M001 與 M003 在 2026-10-01 至 2026-11-30（含）之間的打卡紀錄

#### Scenario: 不帶 memberIds 維持匯出全員
- **WHEN** 管理員呼叫 `GET /api/admin/export-records`（不帶 `memberIds`）
- **THEN** 回傳 CSV 含所有成員的紀錄，行為與本次變更前一致

### Requirement: 管理後台觸發入口
管理後台「罰款總結」Tab SHALL 提供觸發全員打卡明細匯出的按鈕，點擊後直接下載 CSV，不需額外跳轉或輸入參數。

管理後台 SHALL 另提供一個可選的多選成員篩選介面，置於匯出按鈕旁。未勾選任何成員時，點擊匯出按鈕 MUST 維持匯出全員的行為；勾選一位或多位成員後，匯出 MUST 僅含勾選成員的紀錄。

#### Scenario: 管理後台觸發匯出
- **WHEN** 管理員於「罰款總結」Tab 點擊「全部紀錄 CSV」按鈕
- **THEN** 瀏覽器下載該 CSV 檔案

#### Scenario: 管理後台觸發匯出（未勾選成員，維持全員）
- **WHEN** 管理員於「罰款總結」Tab 未勾選任何成員，點擊「全部紀錄 CSV」按鈕
- **THEN** 瀏覽器下載含全員紀錄的 CSV 檔案

#### Scenario: 管理後台觸發匯出（指定成員）
- **WHEN** 管理員於「罰款總結」Tab 勾選 1 位成員，點擊「全部紀錄 CSV」按鈕
- **THEN** 瀏覽器下載僅含該成員紀錄的 CSV 檔案
