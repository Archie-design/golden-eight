## 1. 移除行程導覽列入口

- [x] 1.1 `components/Navbar.tsx`：`NAV_LINKS` 移除 `{ href: '/schedule', label: '行程' }` 一行
- [x] 1.2 確認 `/schedule` 頁面、`app/api/schedule/*`、`schedule_template` 資料均未動

## 2. 移除截圖分享按鈕

- [x] 2.1 `app/(main)/checkin/page.tsx`：移除「截圖分享」`Button`（`onClick={handleShareScreenshot}` 那顆）
- [x] 2.2 保留同排「修改今日」`Button` 與外層 `data-screenshot-exclude` div
- [x] 2.3 `handleShareScreenshot`/`captureAndShare`/`share-image.ts`/退化 Dialog 保留（僅移觸發入口，維持可逆）

## 3. 驗證

- [x] 3.1 `npx tsc --noEmit` + `npm run lint` 通過（若截圖 dead code 觸發 unused error，最小處理：保留必要 import 或 eslint-disable，不刪邏輯）
- [x] 3.2 `openspec validate hide-schedule-and-screenshot --strict` 通過
- [ ] 3.3 手動（部署後）：導覽列無「行程」；打卡完成卡片無「截圖分享」、仍有「修改今日」
- [ ] 3.4 確認未誤刪：`/schedule` 直接打網址仍可進（頁面/API 保留）
