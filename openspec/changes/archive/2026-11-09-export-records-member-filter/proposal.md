# Proposal

## Why

`GET /api/admin/export-records`（全員打卡明細匯出）目前只能匯出「全部成員」或依月份範圍篩選，沒有依成員篩選的能力。管理員若只需要查看少數幾位成員的資料（例如柯啟鴻單人、或幾位需要特別關注的成員），每次都得匯出全員再自行在 Excel 裡篩選，不夠直接。

## What Changes

- `GET /api/admin/export-records` SHALL 新增可選查詢參數 `memberIds`（逗號分隔的成員編號清單，例如 `memberIds=M001,M003`）。省略時維持現有行為（匯出全員）。
- `memberIds` 篩選 SHALL 可與既有 `startMonth`/`endMonth` 月份範圍參數同時套用（例如「只要柯啟鴻 10 月到 11 月的紀錄」）。
- 管理後台「罰款總結」Tab 的「全部紀錄 CSV」按鈕旁 SHALL 新增一個多選成員的篩選介面（沿用既有成員清單資料，不勾選任何人時維持匯出全員的行為，與現狀一致，不造成行為破壞）。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `admin-console`: 「全員打卡明細匯出」需求新增 `memberIds` 篩選參數；「管理後台觸發入口」需求擴充為可選的多選成員篩選介面。

## Impact

- **後端**：[app/api/admin/export-records/route.ts](../../../app/api/admin/export-records/route.ts) 新增 `memberIds` 查詢參數解析與篩選邏輯。
- **前端**：[app/(main)/admin/page.tsx](../../../app/(main)/admin/page.tsx) 「罰款總結」Tab header 新增多選成員元件，觸發匯出時組 `memberIds` 查詢字串。
- **不影響**：既有不帶 `memberIds` 的呼叫方式（匯出全員）行為完全不變；`startMonth`/`endMonth` 既有行為不變；`GET /api/admin/export`（月結摘要匯出）不受影響。
