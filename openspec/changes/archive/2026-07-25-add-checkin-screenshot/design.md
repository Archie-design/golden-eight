## Context

成員打卡完成後手動截圖貼到 LINE 群組留紀錄、互相激勵。要截的畫面是 `app/(main)/checkin/page.tsx` 已打卡卡片（L221–266 的 `<Card className="border-green-200 bg-green-50">`），含得分、打卡時間、8 項任務逐項 ✓。

探索確認的關鍵事實：
- 專案**零截圖能力**（無 html2canvas / html-to-image / navigator.share）。
- 目標卡片**只有文字與 lucide inline SVG，不含任務 jpg**（那些只在未打卡列表）→ 無 CORS 污染 canvas 問題。
- 已是 **standalone PWA**（有 manifest + service worker），且常從 **LINE 內建瀏覽器**開啟（`from=line`）。
- 全站字型走 `next/font`（Geist/Lora）。
- UI 慣例：`Button`（base-ui + cva）、`sonner` toast、`lucide-react`。「修改今日」按鈕（L257）為並列範本。

使用者需求原話是「存進手機相簿」，但實際終點是貼到 LINE 群組（已與使用者確認）→ 採 Web Share 為主路徑。

## Goals / Non-Goals

**Goals:**
- 一鍵把打卡完成卡片轉成乾淨 PNG 並喚起系統分享單（可傳 LINE 群組或存相簿）。
- 在所有實際環境（iOS standalone / Android / LINE webview）都不「按了沒反應」。
- 沿用既有 UI 慣例，視覺與「修改今日」一致。

**Non-Goals:**
- 不做後端、不存圖到伺服器、不改資料庫或計分。
- 不追求「保證直接進相簿」——網頁無此 API；交由分享單讓使用者選。
- 不做客製化分享文案 / 浮水印 / 排版美化（本次僅截現有卡片；美化可另議）。

## Decisions

### 決策 1：用 `html-to-image` 而非 html2canvas
- **理由**：體積小、對現代 CSS 與 inline SVG 支援好、直接提供 `toBlob`（Web Share 需要 File/Blob）。目標卡片無外部圖片，最複雜的 CORS 情境不存在，html-to-image 綽綽有餘。
- **替代**：html2canvas（較重、SVG 支援較弱）。否決。

### 決策 2：主路徑 Web Share `files`，三層退化
```
① navigator.canShare({ files:[png] }) === true
   → navigator.share({ files })  → 系統分享單（含「傳到 LINE」「儲存影像」）
② 不支援 files 分享，但可下載
   → <a download> 觸發下載 + toast 告知「已下載，可從相簿/下載查看」
③ 連下載都不穩（部分 iOS LINE webview）
   → 在畫面顯示該 PNG（blob URL），toast 告知「長按圖片即可儲存」
```
- **理由**：使用者選了「分享單為主」。但 `navigator.share({files})` 支援度不一，退化層確保任何環境可用。取消分享（`AbortError`）視為正常，不報錯。

### 決策 3：截圖範圍與「按鈕不入鏡」
- 截圖抓卡片 `ref`。截圖按鈕與「修改今日」按鈕若在卡片內，會被截進去 → 需排除。
- **作法**：截圖時以 html-to-image 的 `filter`（略過帶特定 `data-screenshot-exclude` 屬性的節點）排除按鈕列；或將按鈕列移出被截 `ref` 之外（按鈕放在 Card 外層）。實作時擇一，spec 要求成圖不含按鈕。

### 決策 4：字型嵌入（唯一實質的坑）
- html-to-image 需把字型嵌入 data URL，否則截圖字型 fallback 成系統字型。
- **作法**：截圖前確保 `document.fonts.ready`；必要時用 html-to-image 的字型嵌入選項。CJK 字型體積大，若嵌入造成明顯延遲，改為「等字型載入完成再截」而非全量嵌入。實機驗證截出的中文字型正確。

## Risks / Trade-offs

- [LINE 內建瀏覽器對 share/download 支援不一] → 三層退化 + 實機測 LINE webview（iOS/Android 各測）。這是本功能最大不確定性，MUST 實機驗證而非假設。
- [字型 fallback 使截圖變醜] → `document.fonts.ready` + 實測；CJK 嵌入過大則改等載入。
- [截圖把按鈕也截進去] → filter 排除或按鈕移出 ref，spec 以 scenario 卡住。
- [html-to-image 對 base-ui / tailwind 某些樣式渲染落差] → 目標卡片樣式單純（綠底、SVG 勾勾、文字），風險低；實測確認。
- [service worker 快取致依賴載入問題] → 新依賴走一般 bundle，不受 sw 的 `/icons/tasks/` cache-first 影響。

## Migration Plan

- 純前端新增，無資料遷移、無 schema、無環境變數。
- `npm install html-to-image` → 加按鈕與處理函式 → build。
- 回滾：移除按鈕與依賴即可，無殘留狀態。
- **上線前 MUST 實機測試**：iOS standalone PWA、Android Chrome、iOS LINE 內建瀏覽器、Android LINE 內建瀏覽器——確認分享單喚起或退化路徑皆可用、截圖字型正確、按鈕不入鏡。

## Open Questions

- 退化路徑②③的優先順序是否需依偵測到的環境微調（例如偵測到 iOS 就直接走顯示圖片供長按）——待實機測試結果決定。
- 是否要在截圖上加日期浮水印或 app 標記以利群組識別——本次不做，視使用反饋再議。
