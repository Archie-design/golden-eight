## ADDED Requirements

### Requirement: Webhook 簽章驗證
`/api/line/webhook` SHALL 為公開端點（LINE 伺服器呼叫，無 JWT / CRON_SECRET）。系統 MUST 以 Messaging channel secret 對原始 request body 計算 HMAC-SHA256 並 base64 編碼，與 `x-line-signature` header 比對；不符者 MUST 回 401 並不處理任何事件。

系統 MUST NOT 信任未通過簽章驗證的請求 body 中的任何 userId。

#### Scenario: 有效簽章
- **WHEN** 收到帶正確 `x-line-signature` 的 webhook 請求
- **THEN** 驗章通過，處理其事件

#### Scenario: 無效或缺少簽章
- **WHEN** `x-line-signature` 缺少或與計算值不符
- **THEN** 回 401，不寫入任何 userId、不回覆任何訊息

---

### Requirement: follow 事件取得 Bot-scoped userId
系統 SHALL 處理 `follow` 事件（使用者加 Bot 好友），從 `event.source.userId` 取得 Bot Provider 下的正確 userId。此 userId MUST 寫入 `members.line_bot_user_id`，MUST NOT 覆寫既有 `line_user_id`（Login channel 用途不同）。

因 webhook 事件無登入 session，userId 與成員的對應 MUST 依 design 定義的連結機制建立；在成功連結前，系統 MUST 暫存或忽略無法對應的 userId，MUST NOT 任意寫到某成員身上。

#### Scenario: 已可對應的成員加好友
- **WHEN** 收到 `follow` 事件且該 userId 已能對應到某成員（依連結機制）
- **THEN** 將 `line_bot_user_id` 寫入該成員

#### Scenario: 尚無法對應的 userId
- **WHEN** 收到 `follow` 事件但該 userId 尚無法對應任何成員
- **THEN** 系統 MUST NOT 將其寫入任意成員；依 design 暫存待後續連結或忽略

---

### Requirement: 推播收件人改用 line_bot_user_id
`daily-status-digest` 的推播 MUST 以 `members.line_bot_user_id` 為收件人，MUST NOT 再使用 `line_user_id`（後者保留供 LINE 登入）。`is_admin = true`、`status = '活躍'` 且 `line_bot_user_id` 非空者才納入收件人。

#### Scenario: 僅推播給已取得 Bot userId 的管理員
- **WHEN** 一位管理員 `line_bot_user_id` 已寫入、另一位僅有 `line_user_id`
- **THEN** 僅前者收到推播；後者略過

---

### Requirement: line_bot_user_id 唯一性
`line_bot_user_id` MUST 於成員間唯一（一個 Bot userId 只能連結一位成員），以部分唯一索引（非空時）保證。

#### Scenario: 同一 Bot userId 不重複連結
- **WHEN** 某 `line_bot_user_id` 已連結成員 A，嘗試再連結成員 B
- **THEN** 系統 MUST 拒絕或改綁，MUST NOT 使兩位成員共用同一 userId
