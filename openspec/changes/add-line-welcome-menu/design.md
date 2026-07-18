## Context

`add-line-bot-commands` 剛上線：webhook（`app/api/line/webhook/route.ts`）目前只處理 `message.text`，`lib/line-commands.ts` 有指令解析與回覆組裝（純函式），`lib/line-push.ts` 有 `replyMessage`（reply token，免費）與 `pushTextToUsers`。個人統計已有 `formatMyStatus` + `buildPersonalReply` 的 DB 查詢序列。

本次要在此基礎上加一張「歡迎卡」（Flex Message，參考「定課小幫手」風格但內容為黃金八套餐規則），三顆按鈕：參加定課 / 完成定課（URI → 網頁）、個人統計（postback → LINE 回「我的狀態」）。觸發：`follow` 事件 + 「選單」指令。

確認事實：
- 網頁頁面：註冊/登入 = `/`（`app/page.tsx`，含 login/register tab）；打卡 = `/checkin`；統計頁 = `/dashboard`。
- 站台網址：webhook 已有由 `LINE_CALLBACK_URL` 推 `origin` 的做法（`bindUrl()`），Flex 按鈕 URI 沿用同一推導。
- `replyMessage` 目前型別限 `LineTextMessage[]`，Flex 需放寬訊息型別。

## Goals / Non-Goals

**Goals:**
- 一張 Flex 歡迎卡：黃金八套餐規則說明 + 三按鈕。
- follow 事件自動推卡；「選單/開始/menu」指令喚出卡。
- 參加/完成 → URI 開網頁；個人統計 → postback 在 LINE 回個人資料（複用既有）。
- postback 沿用隱私分流：群組不洩漏個人數字；未綁定回引導。

**Non-Goals:**
- 不做 Rich Menu（常駐圖文選單，另一套機制、需上傳圖片與 API 設定）。
- 不把打卡搬進 LINE（8 項任務+工時仍在網頁）。
- 不改計分 / schema / 既有指令查詢行為。
- 不做卡片多語系 / 動態圖片 / 客製每人不同卡片。

## Decisions

### 決策 1：Flex Message，不用 Rich Menu
- 需求是「加好友時出現、可點按鈕」——Flex Message（訊息氣泡內含按鈕）即滿足，且能隨 follow 事件或指令即時送出。Rich Menu 是聊天室底部常駐選單，需上傳 2500×1686 圖片 + tap area 設定，體驗不同、工程量大，本次 Non-Goal。

### 決策 2：`lib/line-flex.ts` 純函式組卡
- 新增 `buildWelcomeFlex(siteUrl): LineFlexMessage`：吃站台網址，吐 LINE Flex message 物件（bubble）。純函式、無 DB/fetch，便於測試與調樣式。
- 規則文字（8 項門檻、罰金、結算）以常數組進 body；按鈕區三顆：
  - 參加定課：`{ type:'uri', uri: `${siteUrl}/` }`
  - 完成定課：`{ type:'uri', uri: `${siteUrl}/checkin` }`
  - 個人統計：`{ type:'postback', data:'action=my_stats', displayText:'個人統計' }`
- `displayText` 讓使用者點按後在聊天室顯示「個人統計」字樣，體驗一致。

### 決策 3：放寬 push/reply 訊息型別以支援 Flex
- `lib/line-push.ts`：新增 `LineFlexMessage` 型別；`replyMessage`／`pushTextToUsers` 的訊息參數型別由 `LineTextMessage[]` 放寬為 `LineMessage[]`（text | flex 聯集），或新增 `replyFlex(replyToken, flex)`／`pushFlex(userId, flex)`。採「放寬既有函式型別」最省重複，body 直接帶 `messages`。

### 決策 4：webhook 事件迴圈擴充 follow / postback
```
for ev of events:
  switch ev.type:
    'message' (text) → 既有：parseCommand → 指令分流
                       新增：kind==='menu' → reply 歡迎卡
    'follow'         → reply/push 歡迎卡（用 replyToken；follow 事件有 replyToken）
    'postback'       → 解析 ev.postback.data：
                          'action=my_stats' → 同「我的狀態」路徑（隱私分流 + 綁定檢查）
```
- follow 事件 LINE 有提供 `replyToken`，優先用 reply（免費）；不另呼叫 push。
- postback 的 `source.type` 判斷與 message 相同：群組 postback 個人統計 → 回導向私訊文字。

### 決策 5：「選單」加入既有 parseCommand
- `parseCommand` 新增別名：`選單 / 開始 / menu / 主選單` → 新 kind `'menu'`。`isPublicCommand('menu')` 視為公開（卡片本身公開，個人按鈕自帶隱私分流），群組亦可喚出。

## Risks / Trade-offs

- **[Flex JSON 結構繁瑣易錯]** LINE Flex 巢狀結構嚴格，欄位錯會整則發送失敗。→ `buildWelcomeFlex` 純函式 + 以 LINE Flex Simulator 對過結構；單測驗證關鍵欄位（三按鈕 type/uri/data 正確）。
- **[postback data 偽造]** 理論上 postback data 由我們自己定義、LINE 轉發；惡意使用者無法輕易偽造他人 postback（仍以 `source.userId` 綁定成員後才回個人資料）。隱私邊界不因 postback 而放寬。
- **[follow 事件無 userId 綁定]** 新加好友者多半未綁定成員 → 歡迎卡本身為公開內容（規則 + 按鈕），不含個人資料，無隱私問題；點個人統計才觸發綁定檢查。
- **[URI 用 localhost]** 本地 `LINE_CALLBACK_URL=localhost` → 按鈕會指向 localhost。線上環境變數為正式網址即正確；tasks 註明線上 URI 依部署網址。
- **[訊息型別放寬影響既有呼叫]** 放寬 `replyMessage` 型別為聯集，既有 text 呼叫仍合法（text 是聯集成員）；需 tsc 確認 daily-digest 等既有 push 呼叫不受影響。

## Migration Plan

- 純新增/擴充接收側：`lib/line-flex.ts`（新）、`lib/line-commands.ts`（加 menu 別名）、`lib/line-push.ts`（放寬型別）、`app/api/line/webhook/route.ts`（加 follow/postback 分支）。無 schema、無資料遷移、無新環境變數。
- **部署前置（LINE Console）**：webhook 已啟用即含 follow/postback 轉發；確認官方帳號「加入好友的歡迎訊息」關閉（避免與我們的歡迎卡重複）。
- 回滾：移除 follow/postback 分支 + flex builder + menu 別名，指令查詢功能不受影響。
- 上線後驗證：加好友 → 收到歡迎卡；點三按鈕行為正確；群組點個人統計不洩漏。

## Open Questions

- 歡迎卡規則文案細節（罰金金額、結算日）是否要與截圖完全一致，或用黃金八套餐實際規則——採實際規則（8 項任務、Gold/Silver/Bronze 門檻與罰金），非照抄截圖的「50 元/次月 1 號結算」。
- 個人統計按鈕在群組是否乾脆隱藏（而非點了才擋）——LINE Flex 無法依情境動態改按鈕，故統一保留按鈕、點擊時分流。
- follow 後是否也順帶提示「打『幫助』看更多指令」——可加一行，不影響主結構。
