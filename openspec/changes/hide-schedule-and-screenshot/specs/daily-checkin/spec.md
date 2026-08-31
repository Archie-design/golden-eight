## MODIFIED Requirements

### Requirement: 打卡完成畫面截圖分享
截圖分享功能目前**暫停**：打卡完成卡片 MUST NOT 顯示「截圖分享」按鈕，成員無從觸發截圖。截圖能力的程式（`lib/share-image.ts`、`captureAndShare`、`handleShareScreenshot`）保留於程式碼中備用，僅移除觸發入口；日後恢復僅需加回按鈕。

「修改今日」按鈕不受影響，仍於已完成卡片顯示。

#### Scenario: 產生截圖圖片
- **WHEN** 成員檢視已完成打卡的卡片
- **THEN** 卡片 MUST NOT 出現「截圖分享」觸發入口，無從產生截圖（功能暫停）

#### Scenario: 截圖不含操作按鈕
- **WHEN** 檢視已完成卡片
- **THEN** 因無截圖按鈕，此情境不再適用；「修改今日」按鈕仍顯示

#### Scenario: 截圖能力程式保留
- **WHEN** 檢視程式碼
- **THEN** `lib/share-image.ts` 與相關 handler 保留，僅不再有 UI 觸發點
