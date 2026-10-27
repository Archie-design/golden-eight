# Proposal

## Why

管理後台目前唯一的匯出端口（`GET /api/admin/export`）只能匯出「單一月份的月結摘要」（`monthly_summary` 彙總數字：總分/達成率/罰款），無法匯出 `checkin_records` 的每日逐筆原始打卡資料（8 項任務勾選狀態、工時、備註、慢跑記錄等），也沒有「一次匯出跨月/全部歷史」的功能。管理員若需要外部分析、備份或稽核原始資料，目前只能透過「個人每日記錄查詢」分頁一人一月手動查看，無法批次取得。

## What Changes

- 新增 `GET /api/admin/export-records`（admin 限定）：匯出全員跨月份的逐日打卡明細 CSV，可選填 `startMonth`/`endMonth`（`YYYY-MM`）限定範圍，省略則匯出全部歷史。
- CSV 每列代表一位成員某一天的打卡紀錄，欄位含：成員編號、姓名、日期、8 項任務各自勾選狀態、`base_score`、`punch_bonus`、`total_score`、`punch_streak`、`work_hours`、`note`、`run_minutes`、`run_km`、`submit_time`。
- 沿用既有 `lib/csv.ts` 的 `csvField`/`csvRow`（公式注入防護）與 `/api/admin/export` 的既有慣例（UTF-8 BOM、`Content-Disposition: attachment`）。
- 管理後台「罰款總結」Tab 的既有匯出按鈕列新增第二顆按鈕（例如「全部紀錄 CSV」），觸發此端口。不新增獨立分頁。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `admin-console`: 新增一條需求，描述全員跨月逐日打卡明細匯出端口（`GET /api/admin/export-records`）與其觸發入口；與既有「罰款總結 Tab」需求中描述的 `GET /api/admin/export`（月結摘要匯出）為互補而非取代關係，兩者並存。

## Impact

- **後端**：新增 [app/api/admin/export-records/route.ts](../../../app/api/admin/export-records/route.ts)，複用既有 `requireAdmin()`、`lib/csv.ts`。查詢 `checkin_records` 全表或指定月份範圍（目前規模約 3229 筆、32 位成員，單次查詢即可，不需要分頁或背景任務）。
- **前端**：[app/(main)/admin/page.tsx](../../../app/(main)/admin/page.tsx) 「罰款總結」Tab header 新增一顆匯出按鈕。
- **不影響**：既有 `GET /api/admin/export`（月結摘要匯出）、`monthly_summary` 相關邏輯、其他分頁皆不變。
