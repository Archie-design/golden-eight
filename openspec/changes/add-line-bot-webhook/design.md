## Context

`add-daily-status-digest` 已完成快照與摘要，唯投遞受阻：LINE userId 是 Provider-scoped，Login channel（ID `2009794889`）收集的 `line_user_id` 對 Messaging Bot（`@581etqxs`）無效（三位管理員 profile 全數 404，加好友後仍 404，已排除「未加好友」）。

正確的 Bot-scoped userId 只在使用者與 Bot 互動時經 webhook 送達 `event.source.userId`。目前 Bot 為 `chatMode: chat` 且無 webhook 接收端，故取不到。

核心難題：webhook 事件**沒有登入 session**——LINE 只給「這個 Bot userId 做了某事」，但系統不知道這個 userId 是哪位成員。既有的 LINE 登入綁定靠 JWT 知道當前成員，webhook 沒有這個線索。

## Goals / Non-Goals

**Goals:**
- 取得 Bot Provider 下正確的 userId 並安全連結到對應成員。
- 讓 digest 推播能真正送達（至少 3 位管理員）。
- webhook 端點安全：驗簽章、拒偽造。

**Non-Goals:**
- 不改動 LINE 登入綁定（`line_user_id` 保留原用途）。
- 不強迫 20 位成員重新綁定 Login（那是被否決的方案 A）。
- 不在此變更處理「推給全體學員」的綁定率問題——先讓管理員收到。
- 不動 digest 的摘要邏輯，只換收件人欄位來源。

## Decisions

### 決策 1：新增 `line_bot_user_id` 欄位，與 `line_user_id` 分離
- **理由**：兩者是不同 Provider 的不同 ID，語意不同（登入 vs 推播）。混用會再次踩到 Provider-scoped 的坑。
- 部分唯一索引（非空時），一個 Bot userId 只連結一位成員。

### 決策 2：userId → 成員 的連結機制（本變更的關鍵取捨）

webhook 無 session，需要一套明確連結方式。候選：

| 方案 | 作法 | 優點 | 缺點 |
|---|---|---|---|
| **2a 綁定碼** | 成員登入後頁面顯示一組短期綁定碼；成員傳給 Bot；webhook 收到 `message` 比對碼 → 連結該成員 | 明確、可自助、可驗證是本人 | 需前端顯示碼 + 碼的暫存與過期 |
| **2b displayName 人工對應** | webhook 存下 userId + LINE displayName 到暫存區；管理員在後台手動把 userId 指派給成員 | 實作簡單、3 人規模可行 | 人工、不可規模化到學員 |
| **2c 深連結帶 token** | 從已登入頁面產生帶 member token 的加好友連結；follow 事件夾帶該 token | 一鍵、無需傳碼 | LINE follow 事件的 dataload 支援有限，需驗證可行性 |

- **傾向 2a（綁定碼）**：兼顧自助與正確性，且是未來推給學員時可沿用的正規流程。3 位管理員先走一次即可驗證。**2b 可作為 fallback**（3 人規模人工指派成本極低），若 2a 前端工作量偏大可先上 2b 讓推播盡快通。
- 待實作時依前端成本二選一，或先 2b 後 2a。

### 決策 3：webhook 簽章驗證用 Messaging channel secret
- **理由**：webhook 是公開端點，唯一防偽手段是 LINE 簽章（HMAC-SHA256(body, channel secret) base64 == `x-line-signature`）。
- Messaging channel secret 與 Login channel 的 `LINE_CHANNEL_SECRET` 不同，需新增環境變數（如 `LINE_MESSAGING_CHANNEL_SECRET`）以免混用。

### 決策 4：Bot 需切 `bot` 模式並啟用 webhook
- 現況 `chatMode: chat`（人工客服傾向），webhook 預設關閉。需在 Console 啟用 webhook URL 並切模式。此為部署前置，非程式碼，記於 tasks 並標明需人工操作。

## Risks / Trade-offs

- [webhook 端點被偽造請求灌入假 userId] → 強制簽章驗證；未過驗證不處理、不寫入。
- [Next.js 讀 raw body 做簽章] → 簽章需對「原始位元組」計算，須確保未被框架改寫（用 `await req.text()` 取原始字串再驗，勿先 `req.json()`）。
- [連結機制選錯導致誤綁] → 2a 綁定碼綁定當前登入成員，天然防誤綁；2b 人工指派需後台二次確認。唯一索引兜底一個 userId 不跨成員。
- [Console 設定未就緒即部署] → tasks 明列 Bot webhook / 模式為前置，且需實測一次 follow 事件確認 `source.userId` 真的送達。
- [Provider 假設再次落空] → 上線後 MUST 以真實 follow 事件驗證 `line_bot_user_id` 能被 `/v2/bot/profile` 查到（即 push 可送達），再宣告完成——不重蹈本次「假設 userId 可用」的覆轍。

## Migration Plan

1. 加 `line_bot_user_id` 欄位 + 唯一索引（migration，正式環境於 SQL Editor 套用）。
2. Console：Bot 切 `bot` 模式、設定 webhook URL、關閉自動回覆（視需要）。
3. 設 `LINE_MESSAGING_CHANNEL_SECRET`。
4. 部署 webhook 路由。
5. 三位管理員各自加 Bot 好友並完成連結（依 2a/2b）。
6. **驗證**：對已連結的 userId 呼叫 `/v2/bot/profile` 應可查到；觸發 digest 應真正送達。
7. 回滾：移除 webhook 路由與排程依賴；`line_bot_user_id` 欄位保留無副作用。

## Open Questions

- 連結機制 2a（綁定碼）vs 2b（人工指派）的最終選擇——待前端成本評估，或先 2b 讓推播盡快通、再補 2a。
- `message` 事件除了綁定碼，是否要做其他互動（如查詢個人進度）？本變更暫不擴張，僅取 userId。
