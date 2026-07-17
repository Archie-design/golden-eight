## 1. 前置（Console 設定，人工，非程式碼）

- [ ] 1.1 LINE Console：Bot 由 `chatMode: chat` 切為 `bot` 模式
- [ ] 1.2 設定 webhook URL 指向 `https://<host>/api/line/webhook` 並啟用 webhook
- [ ] 1.3 取得 Messaging channel secret，設為 `LINE_MESSAGING_CHANNEL_SECRET`（與 Login 的 `LINE_CHANNEL_SECRET` 區分）

## 2. 資料層

- [ ] 2.1 migration：`members` 加 `line_bot_user_id TEXT` + 部分唯一索引 `WHERE line_bot_user_id IS NOT NULL`
- [ ] 2.2 同步 `supabase/schema.sql`；於 SQL Editor 對正式 DB 套用
- [ ] 2.3 更新 `Member` type（`types/index.ts`）加 `line_bot_user_id?: string | null`

## 3. Webhook 端點

- [ ] 3.1 新增 `app/api/line/webhook/route.ts`：以 `await req.text()` 取**原始** body，HMAC-SHA256(body, MESSAGING secret) base64 與 `x-line-signature` 比對，不符回 401
- [ ] 3.2 解析事件；處理 `follow`（取 `source.userId`）與 `message`（連結機制用）
- [ ] 3.3 依 design 決策 2 實作連結機制（2a 綁定碼 或 2b 人工指派 fallback）：將 `source.userId` 安全連結到成員並寫 `line_bot_user_id`；無法對應者不寫入任意成員
- [ ] 3.4 回應 LINE 200（webhook 需快速回應；重活避免阻塞）

## 4. 推播改用 line_bot_user_id

- [ ] 4.1 `app/api/cron/daily-digest/route.ts`：收件人查詢由 `line_user_id` 改為 `line_bot_user_id`（`is_admin && status='活躍' && line_bot_user_id 非空`）
- [ ] 4.2 確認 `lib/line-push.ts` 無需改（僅收件人來源變）

## 5. 驗證

- [ ] 5.1 `npx tsc --noEmit` + `npm run lint` 通過
- [ ] 5.2 簽章驗證：偽造 / 缺 `x-line-signature` → 401；正確簽章 → 處理
- [ ] 5.3 真實 follow 事件：管理員加 Bot 好友 → webhook 收到 → `line_bot_user_id` 寫入正確成員
- [ ] 5.4 **關鍵驗證**：對寫入的 `line_bot_user_id` 呼叫 `/v2/bot/profile/{id}` 應可查到（證明 userId 對此 Bot 有效，不重蹈 Provider-scoped 覆轍）
- [ ] 5.5 端到端：觸發 `/api/cron/daily-digest`，確認已連結的管理員**真正收到** LINE 摘要
- [ ] 5.6 完成後回 `add-daily-status-digest` 補完其 task 5.8
