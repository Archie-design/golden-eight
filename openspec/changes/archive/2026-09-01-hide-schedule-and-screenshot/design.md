## Context

要下架「行程」與「打卡截圖分享」兩個功能。盤點：

- **行程**：導覽列 `components/Navbar.tsx` 的 `NAV_LINKS` 有 `/schedule` 項；頁面 `app/(main)/schedule/`；API `app/api/schedule/{data,public,tag,template}`；資料表 `schedule_template`（現有 24 筆成員資料）。grep 確認**未被別處引用**（夥伴/排行/儀表板都不依賴）。
- **截圖分享**：`app/(main)/checkin/page.tsx` 已完成卡片內一顆「截圖分享」`Button`（與「修改今日」同一排 `data-screenshot-exclude` div）；邏輯在 `lib/share-image.ts` + `handleShareScreenshot`。純前端、不碰 DB。

使用者定調（探索確認）：**藏入口、保留程式與資料、兩個都關、只藏導覽列連結（不擋直接訪問）**。核心是「可逆、零刪除」。

## Goals / Non-Goals

**Goals:**
- 導覽列拿掉「行程」連結。
- 打卡頁移除「截圖分享」按鈕（保留同排「修改今日」）。
- 程式、API、頁面、資料全數保留，回滾只需還原入口。

**Non-Goals:**
- 不刪 `/schedule` 頁面/API、不刪 `share-image.ts`、不刪 `schedule_template` 資料。
- 不擋 `/schedule` 直接訪問（使用者選最輕方案）。
- 不改計分、其他頁面。

## Decisions

### 決策 1：只移入口，程式全留（可逆優先）
- Navbar 刪一行陣列項；checkin 刪一顆 Button。其餘一律不動。
- `handleShareScreenshot`/`captureAndShare`/`share-image.ts` 保留——雖成 dead code，但保留使「開回來」= 加回按鈕，零重寫。lint 可能因 unused 警告 `handleShareScreenshot`/`sharing`/`Share2`；若報 unused-var error 才最小處理（如保留 import 或加註），優先不動邏輯。

### 決策 2：截圖按鈕移除但不動同排結構
- 「截圖分享」與「修改今日」同在一個 `data-screenshot-exclude` div。**只刪「截圖分享」那顆 Button**，保留 div 與「修改今日」。避免誤刪整排。

### 決策 3：不擋 /schedule 直接訪問
- 使用者選「最輕」：頁面/API 留著，直打網址仍可進。一般使用者不手打網址，實務足夠；日後若要更嚴再加 redirect。

## Risks / Trade-offs

- **[截圖 dead code 的 lint unused]** 移除按鈕後 `handleShareScreenshot`、`sharing` state、`Share2` import 可能變 unused。→ 若 lint 報 error，最小處理（保留必要 import 或以 eslint-disable）；不刪邏輯以保可逆。實作時看 lint 結果決定。
- **[直接訪問 /schedule]** 入口藏了但網址仍可達——使用者已接受（最輕方案）。非資安問題（本就是登入後功能）。
- **[誤刪同排按鈕]** → 決策 2 明確只刪一顆 Button。

## Migration Plan

- 純前端移除兩入口：Navbar 一行、checkin 一顆 Button。無 schema、無 migration、無 API 變更、無資料異動。
- 回滾：Navbar 加回 `{ href:'/schedule', label:'行程' }`；checkin 加回截圖 Button。程式與資料都在。
- 驗證：導覽列無「行程」；打卡完成卡片無「截圖分享」、仍有「修改今日」；`/schedule` 直打仍可進（確認未誤刪）；tsc/lint 通過。

## Open Questions

- 截圖 dead code 要不要順手清（移除 handler/import）——本次保留以維持可逆；若日後確定不再開，另案清理。
- /schedule 日後要不要連直接訪問也擋——目前不做，視需求。
