## Why

剛上線的 LINE bot 指令（`add-line-bot-commands`）需要成員記得打字才會用，發現門檻高。參考「定課小幫手」的介面風格，用一張帶按鈕的**歡迎卡（Flex Message）**在成員加好友時自動出現，把「參加定課／完成定課／個人統計」做成一點即用的按鈕，降低使用門檻、也讓群組新成員一眼看懂玩法。

## What Changes

- **新增歡迎卡（Flex Message）**：含黃金八套餐的規則說明（8 項任務、噴分門檻、罰金、結算時間）與三顆操作按鈕。
- **三顆按鈕行為（已與使用者確認）**：
  - 🎯 **參加定課** → URI action，開網頁**註冊頁**（`/`，站台既有登入/註冊）。
  - ✅ **完成定課** → URI action，開網頁**打卡頁**（`/checkin`）。打卡邏輯（8 項任務、工時）**全留在網頁 PWA**，不搬進 LINE。
  - 📊 **個人統計** → **postback** action，直接在 LINE 回「我的狀態」（**複用既有 `formatMyStatus`**）。
- **觸發時機**：
  - `follow` 事件（成員加 bot 好友）→ 自動推歡迎卡。
  - 文字指令「選單」「開始」「menu」→ 回歡迎卡。
- **擴充 webhook 事件處理**：現行 webhook 只處理 `message.text`，本次加 `follow` 事件與 `postback` 事件的處理分支。
- **postback 隱私分流**：個人統計 postback 僅在 `user`（一對一）情境回個人資料；群組情境回導向私訊（沿用既有隱私原則）。

不改計分、不改打卡流程、不改資料庫 schema。不做 Rich Menu（常駐圖文選單為另一套機制，本次 Non-Goal）。不把打卡搬進 LINE。

## Capabilities

### New Capabilities
- `line-welcome-menu`: LINE bot 歡迎卡與按鈕互動的能力——涵蓋 Flex Message 歡迎卡內容（規則說明 + 三按鈕）、follow 事件自動推卡、「選單」指令喚出卡、URI 按鈕導向網頁（註冊／打卡）、postback 按鈕在 LINE 回個人統計、postback 的群組/私訊隱私分流。

### Modified Capabilities
<!-- 無：`line-bot-commands` 尚未 archive（無 base spec 可做 MODIFIED delta），
     故本次「選單指令」「follow/postback 事件」等新行為一併以 ADDED 收進新
     capability `line-welcome-menu`。既有指令查詢行為不變。 -->


## Impact

- **修改** `app/api/line/webhook/route.ts`：事件迴圈新增 `follow`／`postback` 分支；`message.text` 分支新增「選單」指令 → 推歡迎卡。
- **新增** `lib/line-flex.ts`（或併入 `lib/line-commands.ts`）：`buildWelcomeFlex(siteUrl)` 組出 Flex Message JSON（純函式，吃站台網址、吐 message 物件）。
- **修改** `lib/line-commands.ts`：`parseCommand` 增「選單／開始／menu」→ 新 `menu` 指令 kind。
- **修改** `lib/line-push.ts`：`replyMessage`／`pushTextToUsers` 的訊息型別放寬到可帶 Flex message（非純 text），或新增 `replyFlex` / `pushFlex`。
- **相依既有**：`formatMyStatus`（個人統計 postback 複用）、站台網址推導（沿用 webhook 既有 `LINE_CALLBACK_URL` → origin 的做法）。
- **LINE Console**：需啟用回應 `follow` 事件（webhook 已開即含）；不需新環境變數。
- 回滾：移除 follow/postback 分支 + flex builder 即可，指令查詢功能不受影響。
