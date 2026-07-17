## Why

成員打卡完成後，習慣手動截圖打卡紀錄畫面、貼到 LINE 戰士群組留紀錄、互相激勵（見群組實況：成員截圖「今日已打卡 X 分 + 8 項任務逐項完成」畫面分享）。手動截圖需自行框畫面、可能截到瀏覽器網址列與雜訊，體驗零散。提供一鍵把打卡完成畫面轉成乾淨圖片並喚起系統分享，能降低分享摩擦、強化群組打卡文化。

## What Changes

- 打卡完成卡片新增「截圖分享」按鈕，與既有「修改今日」按鈕並列。
- 按下後將該卡片 DOM 轉成 PNG 圖片，優先透過 **Web Share API**（`navigator.share({ files })`）喚起系統分享單，使用者可直接「傳到 LINE 群組」或「儲存影像」到相簿。
- **退化路徑**：偵測到環境不支援檔案分享時（部分 LINE 內建瀏覽器 / 舊裝置），退化為下載圖片或在畫面顯示圖片供長按儲存，並以 toast 告知。按鈕在任何環境 MUST NOT「按了沒反應」。
- 新增前端依賴 `html-to-image`（專案目前無任何 DOM 轉圖片能力）。
- 純前端功能，不動任何後端、資料庫、計分邏輯。

## Capabilities

### New Capabilities
<!-- 無新 capability。 -->

### Modified Capabilities
- `daily-checkin`: 在「已完成打卡」的呈現中，新增「將打卡完成畫面截圖並分享」的能力。屬打卡完成後的使用者動作，不改變打卡、計分、修改等既有行為。

## Impact

- **前端**：`app/(main)/checkin/page.tsx` 的已打卡卡片加 `ref` + 截圖按鈕與處理函式。
- **新依賴**：`html-to-image`（`package.json`）。
- **UI 慣例沿用**：`Button`（`variant="outline" size="sm"` 綠色系，比照「修改今日」）、`sonner` toast、`lucide-react` 圖示（`Share2` / `Camera`）。
- **不影響**：後端 API、資料表、計分、成就、月結、每日摘要。
- **無 CORS 風險**：截圖目標卡片僅含文字與 lucide inline SVG，不含任務 jpg 圖片（那些只在未打卡列表出現）。
- **需處理的坑**：字型嵌入（全站 `next/font`，html-to-image 需嵌入字型或等載入完成，否則截圖字型 fallback）；LINE 內建瀏覽器的 share/download 支援不一，需實機測試。
