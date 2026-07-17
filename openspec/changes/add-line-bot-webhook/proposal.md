## Why

`add-daily-status-digest` 的摘要推播已就緒，但投遞管道打不通：實測三位管理員全數 `HTTP 400 / profile 404`，且其中一位加了 Bot 好友後仍 404。根因是 **LINE userId 是 Provider-scoped**——現有 `members.line_user_id` 由 LINE Login channel 收集，與 Messaging API Bot（`@581etqxs`，星光黃金八套餐小幫手）不在同一 Provider，故 Login 發出的 userId 對推播無效。

要能推播，必須取得「Bot 所屬 Provider 下的正確 userId」。該 userId 只在使用者與 Bot 互動（加好友 / 傳訊）時，由 LINE 經 **webhook** 送達。目前 Bot 無 webhook 接收端，這些 userId 無從取得。

（相較於「在 Bot 的 Provider 下新建 Login channel 並要求 20 人全部重新綁定」，webhook 只需「加 Bot 好友」一道工，而加好友本就是 LINE 推播的硬前提；此為 design 已評估的較低成本路徑。）

## What Changes

- 新增 Bot webhook 接收端 `/api/line/webhook`：驗證 LINE 簽章（`x-line-signature`，HMAC-SHA256 with Messaging channel secret），處理 `follow`（加好友）與 `message`（傳訊）事件，取得 Bot-scoped userId。
- 新增 `members.line_bot_user_id` 欄位：儲存 Bot Provider 下的 userId，與既有 `line_user_id`（Login channel，登入用）分開。推播 MUST 改用 `line_bot_user_id`。
- 提供「將 Bot userId 連結到成員」的機制：webhook 收到的 userId 無登入 session，需一套綁定流程（見 design：候選為「已登入成員頁面顯示綁定碼 → 傳給 Bot」或「以 LINE displayName 輔助人工對應」）。
- `daily-status-digest` 的推播對象改為 `is_admin && line_bot_user_id 非空`；`line_user_id` 不再用於推播（仍用於 LINE 登入）。
- 前置設定：Bot `chatMode` 由 `chat` 改為 `bot` 並啟用 webhook（Console 操作，非程式碼）。

## Capabilities

### New Capabilities
- `line-bot-webhook`: LINE Bot webhook 接收與簽章驗證、follow/message 事件處理、Bot-scoped userId 取得與成員連結。

### Modified Capabilities
- `daily-status-digest`: 推播收件人來源由 `line_user_id` 改為 `line_bot_user_id`。（僅收件人欄位變更，摘要邏輯不動。）

## Impact

- **新欄位**：`members.line_bot_user_id`（migration + `schema.sql`）+ 唯一索引。
- **新路由**：`app/api/line/webhook/route.ts`（公開端點，靠 LINE 簽章驗證，非 `requireAdmin`/`CRON_SECRET`）。
- **修改**：`lib/line-push.ts` 呼叫端與 `app/api/cron/daily-digest/route.ts` 的收件人查詢改用 `line_bot_user_id`。
- **環境變數**：webhook 簽章驗證用 Messaging channel secret（需與 Login channel 的 `LINE_CHANNEL_SECRET` 區分，可能新增 `LINE_MESSAGING_CHANNEL_SECRET`）。
- **Console 設定**：Bot 啟用 webhook + 切 `bot` 模式（部署前置，記於 tasks）。
- **安全**：webhook 為公開端點，MUST 驗證 LINE 簽章拒絕偽造請求；不可信任 body 內的 userId 未經簽章驗證即寫入。
- **不影響**：既有 LINE 登入綁定（`line_user_id` 保留原用途）、打卡、計分、月結、快照邏輯。
