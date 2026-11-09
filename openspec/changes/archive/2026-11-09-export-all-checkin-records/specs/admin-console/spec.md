# Spec Delta

## ADDED Requirements

### Requirement: 全員打卡明細匯出
`GET /api/admin/export-records`（admin 限定）SHALL 匯出全員跨月份的逐日打卡明細 CSV。系統 MUST 接受可選查詢參數 `startMonth`、`endMonth`（皆為 `YYYY-MM` 格式）限定匯出範圍；省略任一或兩者時，MUST 匯出該成員全部歷史紀錄（不設時間下限/上限）。

#### Scenario: 匯出全部歷史
- **WHEN** 管理員呼叫 `GET /api/admin/export-records`（不帶 `startMonth`/`endMonth`）
- **THEN** 回傳 CSV 含所有成員的所有歷史打卡紀錄，每列一筆 `checkin_records`

#### Scenario: 匯出指定月份範圍
- **WHEN** 管理員呼叫 `GET /api/admin/export-records?startMonth=2026-04&endMonth=2026-06`
- **THEN** 回傳 CSV 僅含 2026-04-01 至 2026-06-30（含）之間的打卡紀錄

#### Scenario: 非管理員存取
- **WHEN** 非管理員成員呼叫 `GET /api/admin/export-records`
- **THEN** 回傳 403（`requireAdmin()` 守衛，與其餘 `/api/admin/*` 路由一致）

### Requirement: 打卡明細 CSV 欄位
CSV 每一列 MUST 代表一位成員某一天的 `checkin_records`，欄位依序為：成員編號、姓名、日期、8 項任務各自的勾選狀態（是/否）、`base_score`、`punch_bonus`、`total_score`、`punch_streak`、`work_hours`、`note`、`run_minutes`、`run_km`、`submit_time`。

CSV 輸出 MUST 透過 `lib/csv.ts` 的 `csvField`/`csvRow` 逐欄跳脫，阻擋公式注入字元（`= / + / - / @ / \t / \r`），比照 `GET /api/admin/export` 的既有輸出慣例：UTF-8 BOM 開頭、`Content-Disposition: attachment`。

#### Scenario: 欄位完整呈現一筆紀錄
- **WHEN** 某成員某日完成 8 項任務中的 5 項，`work_hours = 8`，有備註
- **THEN** CSV 該列正確呈現該 5 項為「是」、其餘 3 項為「否」，以及 `work_hours`、`note` 等其餘欄位值

#### Scenario: 防公式注入
- **WHEN** 某筆紀錄的 `note` 欄位內容為 `=HYPERLINK(...)` 等以公式觸發字元開頭的字串
- **THEN** CSV 輸出該欄位值前綴單引號跳脫，Excel 開啟時不會被當成公式執行

### Requirement: 管理後台觸發入口
管理後台「罰款總結」Tab SHALL 提供觸發全員打卡明細匯出的按鈕，點擊後直接下載 CSV，不需額外跳轉或輸入參數。

#### Scenario: 管理後台觸發匯出
- **WHEN** 管理員於「罰款總結」Tab 點擊「全部紀錄 CSV」按鈕
- **THEN** 瀏覽器下載該 CSV 檔案
