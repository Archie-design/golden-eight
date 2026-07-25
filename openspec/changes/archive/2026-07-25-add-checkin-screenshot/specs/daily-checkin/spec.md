## ADDED Requirements

### Requirement: 打卡完成畫面截圖分享
在「已完成打卡」的呈現中，系統 SHALL 提供「截圖分享」按鈕，將打卡完成卡片（含得分、打卡時間、8 項任務逐項完成狀態）轉為 PNG 圖片供分享或儲存。

截圖範圍 MUST 僅涵蓋打卡完成卡片本身，MUST NOT 包含頁面其他區塊、瀏覽器介面或操作按鈕本身（截圖按鈕與「修改今日」按鈕不應出現在成圖中）。

按鈕 MUST 僅在「已提交且非編輯中」狀態顯示（與卡片同一顯示條件）。

#### Scenario: 產生截圖圖片
- **WHEN** 成員於已打卡卡片點「截圖分享」
- **THEN** 系統將該卡片轉為 PNG 圖片，內容含得分、打卡時間、8 項任務逐項完成狀態

#### Scenario: 截圖不含操作按鈕
- **WHEN** 產生截圖
- **THEN** 成圖 MUST NOT 出現「截圖分享」與「修改今日」按鈕

---

### Requirement: 優先透過系統分享單分享
產生圖片後，系統 SHALL 優先以 Web Share API（`navigator.share({ files })`）喚起系統分享單，使成員可直接傳送至 LINE 群組或儲存至相簿。

系統 MUST 先以 `navigator.canShare({ files })` 檢查環境是否支援檔案分享，支援時才呼叫 `navigator.share`。使用者於分享單取消 MUST 視為正常操作，MUST NOT 顯示為錯誤。

#### Scenario: 支援檔案分享
- **WHEN** 環境支援 `navigator.canShare({ files })`
- **THEN** 喚起系統分享單，圖片作為分享檔案

#### Scenario: 使用者取消分享
- **WHEN** 使用者於系統分享單按取消（`AbortError`）
- **THEN** 視為正常結束，不顯示錯誤 toast

---

### Requirement: 不支援分享時的退化路徑
當環境不支援檔案分享（部分 LINE 內建瀏覽器 / 舊裝置）時，系統 MUST 提供退化路徑，MUST NOT 讓按鈕點擊後無任何反應。退化行為為：下載該 PNG，或於畫面顯示圖片供使用者長按儲存。系統 MUST 以 toast 告知使用者接下來如何操作。

截圖產生或分享過程若發生非取消類錯誤，系統 MUST 以 toast 告知失敗，MUST NOT 靜默失敗。

#### Scenario: 不支援檔案分享
- **WHEN** `navigator.canShare({ files })` 為否或 `navigator.share` 不存在
- **THEN** 執行退化路徑（下載或顯示圖片供長按儲存），並以 toast 告知操作方式

#### Scenario: 截圖產生失敗
- **WHEN** DOM 轉圖片過程拋出錯誤
- **THEN** 以 toast 顯示失敗訊息，不靜默結束
