## Why

「行程」與「打卡截圖分享」兩個功能目前決定先下架。採「藏入口、保留程式與資料」的最輕做法——不刪任何程式碼、API、頁面或成員資料（schedule_template 現有 24 筆），日後想開回來只需還原入口。可逆、零風險。

## What Changes

- **導覽列移除「行程」連結**：`components/Navbar.tsx` 的 `NAV_LINKS` 拿掉 `{ href: '/schedule', label: '行程' }`。使用者看不到入口。
- **打卡頁移除「截圖分享」按鈕**：`app/(main)/checkin/page.tsx` 已完成卡片內移除「截圖分享」那顆 `Button`（保留同排的「修改今日」）。
- **不動的部分（刻意保留，確保可逆）**：
  - `/schedule` 頁面、`app/api/schedule/*`（data/public/tag/template）全部保留——直接打網址仍可進（採「只藏導覽列連結」的最輕方案，一般使用者不會手打網址）。
  - `lib/share-image.ts` 與 checkin 頁的 `handleShareScreenshot`/相關 state 保留（僅移除觸發按鈕）。
  - `schedule_template` 資料表與 24 筆成員資料完全不動。

不刪程式、不刪 API、不刪資料、不改計分。純移除兩個 UI 入口。

## Capabilities

### Modified Capabilities
- `schedule-template`: 隱藏導覽列入口（功能與 API 保留，僅不再從導覽列可達）。
- `daily-checkin`: 移除打卡完成卡片的「截圖分享」按鈕入口（截圖能力程式保留）。

## Impact

- **修改** `components/Navbar.tsx`：`NAV_LINKS` 移除行程項。
- **修改** `app/(main)/checkin/page.tsx`：移除「截圖分享」`Button`（保留「修改今日」與 `handleShareScreenshot`/`captureAndShare` 程式碼備用）。
- **不影響**：schedule 頁面/API/資料、share-image lib、計分、其他頁面（grep 確認行程未被別處引用）。
- 回滾：Navbar 加回連結、checkin 加回按鈕即可，程式與資料都在。
