## Why

目前 LINE bot 只能「單向推播」（`lib/line-push.ts` 走 `/v2/bot/message/push`，由 cron 主動發），成員無法主動查詢。學員想即時知道「我這個月完成率、還差幾天達標、目前排行」時，只能等日報或登入網頁。若讓 bot 能在群組／私訊接收指令並即時回覆，成員在既有的 LINE 群組互動情境中就能自助查數據，提升參與感與自我管理。

## What Changes

- **新增 LINE webhook 接收管道**（目前完全沒有）：`POST /api/line/webhook`，接收 Messaging API 的訊息事件，驗簽章、解析指令、以 `/v2/bot/message/reply` 回覆。
- **新增指令解析與回覆組裝**：把成員輸入的文字對應到查詢，從既有 `lib/scoring.ts` 計算的統計組成回覆文字。
- **場景分流（隱私）**：
  - **群組指令**（來源為 group／room）只回**公開資料**：`排行榜`、`破曉王`、`幫助`。
  - **私訊指令**（來源為 user 一對一）回**個人資料**：`我的狀態`、`今日`、`幫助`。
  - 個人隱私資料（分數／罰金／成就）MUST NOT 在群組回覆。
- **未綁定處理**：查詢需要成員身分但該 `line_user_id` 對應不到成員時，回覆**綁定引導連結**，而非靜默或報錯。
- **新增 push lib 的 reply 能力**：`lib/line-push.ts` 增補 `replyMessage(replyToken, messages)`（reply 免費、不計推播額度）。

不改計分、不改資料庫 schema（僅讀既有資料 + 既有 `line_user_id` 對應）；不改既有 cron 推播。

## Capabilities

### New Capabilities
- `line-bot-commands`: LINE bot 接收成員文字指令並即時回覆數據的能力——涵蓋 webhook 接收與驗簽、指令解析、群組／私訊場景分流與隱私邊界、未綁定引導、個別指令（我的狀態／今日／排行榜／破曉王／幫助）的回覆內容契約。

### Modified Capabilities
<!-- 無既有 spec 的 requirement 變更；LINE 推播先前未建立為獨立 capability spec，本次以新 capability 涵蓋接收側。 -->

## Impact

- **新增** `app/api/line/webhook/route.ts`（webhook 端點；`export const runtime`／簽章驗證）。
- **新增** `lib/line-commands.ts`（指令解析 + 回覆文字組裝，純函式便於測試）。
- **修改** `lib/line-push.ts`：增補 `replyMessage()`（用 reply token，不佔推播額度）。
- **相依既有**：`lib/scoring.ts`（`calcMonthStats`／`isDawnKing`／`calcPenalty` 等）、`members.line_user_id` 對應、`checkin_records`／`monthly_summary` 讀取、`lib/api-helper.ts` 時間邊界（`getCheckinDayTaipei`）。
- **環境變數**：復用 `LINE_CHANNEL_ACCESS_TOKEN`（reply）與 `LINE_CHANNEL_SECRET`（webhook 簽章驗證，注意：Messaging channel 的 secret，與 Login channel 區分）。
- **LINE Console**：需在 Messaging API channel 設定 webhook URL 並啟用；關閉自動回覆訊息。
- 不影響現有 auth／cron／計分；純新增接收側，回滾即移除 route + lib 函式。
