## 1. 依賴

- [x] 1.1 `npm install html-to-image`；確認 build 正常

## 2. 截圖與分享邏輯

- [x] 2.1 新增 `lib/share-image.ts`（或就地於 checkin page）：`captureAndShare(node, filename)` — 以 html-to-image `toBlob` 產生 PNG（截圖前 `await document.fonts.ready`）
- [x] 2.2 主路徑：`navigator.canShare?.({ files:[file] })` 為真 → `navigator.share({ files })`；`AbortError`（使用者取消）視為正常、不報錯
- [x] 2.3 退化路徑②：不支援 files 分享 → `<a download>` 觸發下載 + `toast` 告知
- [x] 2.4 退化路徑③：下載亦不穩（iOS LINE webview）→ 顯示 PNG（blob URL）供長按儲存 + `toast` 告知「長按圖片儲存」
- [x] 2.5 非取消類錯誤 → `toast.error` 告知失敗，不靜默

## 3. 前端整合

- [x] 3.1 `app/(main)/checkin/page.tsx`：已打卡卡片加 `ref`（`cardRef`）掛在 `<Card className="border-green-200 bg-green-50">`（約 L223）
- [x] 3.2 加「截圖分享」按鈕，與「修改今日」並列（`variant="outline" size="sm"` 綠色系，`lucide-react` 的 `Share2`/`Camera`），`onClick` 呼叫 `captureAndShare(cardRef.current, ...)`
- [x] 3.3 確保成圖不含按鈕：截圖 `filter` 排除帶 `data-screenshot-exclude` 的按鈕列，或將按鈕列移到 `ref` 之外

## 4. 驗證

- [x] 4.1 `npx tsc --noEmit` + `npm run lint` 通過
- [ ] 4.2 截圖內容正確：得分、打卡時間、8 項任務逐項狀態；**成圖不含截圖/修改按鈕**
- [ ] 4.3 字型正確：截出的中文為站內字型（非系統 fallback）
- [ ] 4.4 **實機測試（必做，本功能最大不確定性）**：
      - iOS standalone PWA → 分享單喚起、可傳 LINE / 存相簿
      - Android Chrome → 分享單或下載
      - iOS LINE 內建瀏覽器 → 分享單或退化路徑，按鈕不「按了沒反應」
      - Android LINE 內建瀏覽器 → 同上
- [ ] 4.5 取消分享不報錯；不支援環境有 toast 指引
