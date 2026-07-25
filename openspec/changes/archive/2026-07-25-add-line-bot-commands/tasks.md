## 1. 前置：環境變數與 channel secret 釐清

- [x] 1.1 確認 webhook 驗簽要用的 **Messaging channel** secret，與現有 `LINE_CHANNEL_SECRET`（Login channel）區分；若不同，新增 `LINE_MESSAGING_CHANNEL_SECRET`（`.env.local`）並於 design/程式註明用途，避免與 OAuth secret 混用
- [x] 1.2 確認 `LINE_CHANNEL_ACCESS_TOKEN`（Messaging channel，reply 用）已存在於 `.env.local`

## 2. reply 能力（lib/line-push.ts）

- [x] 2.1 於 `lib/line-push.ts` 增補 `replyMessage(replyToken, messages)` → `POST https://api.line.me/v2/bot/message/reply`，用 `LINE_CHANNEL_ACCESS_TOKEN`；沿用既有錯誤隔離風格（失敗記錄、不拋例外）
- [x] 2.2 回傳結果含成功/失敗，reply token 失效時記錄錯誤，MUST NOT fallback 改用 push

## 3. 指令解析與回覆組裝（lib/line-commands.ts，純函式）

- [x] 3.1 新增 `lib/line-commands.ts`：`parseCommand(text)` 正規化（trim、去頭尾標點）後對應到 `my_status | today | leaderboard | dawn_king | help | null`，含別名（狀態/我的進度、今天、排名、help/?/？）
- [x] 3.2 `isPublicCommand(kind)`：僅 `leaderboard | dawn_king | help` 為公開
- [x] 3.3 `formatMyStatus(member, stats, penalty, exempted)`：完成率、階級、達標與否、（未達標）預估罰金；豁免回「本月新進，不參與計分」
- [x] 3.4 `formatToday(tasks|null)`：8 項逐項狀態 + 未完成提示；無紀錄回「今日尚未打卡」
- [x] 3.5 `formatLeaderboard(rows, topN)`：前 N 名名稱 + 完成率
- [x] 3.6 `formatDawnKing(candidates)`：候選名單；空回「目前尚無破曉王候選」
- [x] 3.7 `formatHelp(sourceType)`：依來源標示哪些指令僅限私訊
- [x] 3.8 `formatBindGuide()`：未綁定引導文案 + 綁定連結
- [x] 3.9 `formatGroupPrivacyRedirect()`：群組查個人指令時的「請私訊查詢」文案（不含任何數字）

## 4. Webhook 端點（app/api/line/webhook/route.ts）

- [x] 4.1 新增 `POST /api/line/webhook`：`const raw = await req.text()` 取原始 body（**先驗簽再 parse**）
- [x] 4.2 以 `crypto` 計 `Base64(HMAC-SHA256(messagingSecret, raw))` 比對 `x-line-signature`；不符回 401
- [x] 4.3 驗簽通過後 `JSON.parse(raw)`，遍歷 `events`；非 `message`/非 `text` 事件略過；整體回 200
- [x] 4.4 對每個 text 事件：`parseCommand` → 依 `source.type` 分流（group/room 僅公開指令；個人指令回群組導向私訊文案）
- [x] 4.5 個人指令（private）：以 `source.userId` 查 `members.line_user_id`；對不到 → `formatBindGuide`；查詢前再確認 `source.type==='user'`（雙重防線）
- [x] 4.6 「我的狀態」：撈該成員當月 records → `calcMonthStats` + `calcPenalty`，判斷豁免 → `formatMyStatus`
- [x] 4.7 「今日」：`getCheckinDayTaipei()` 取邏輯日 → 撈該成員該日 record → `formatToday`
- [x] 4.8 「排行榜」：撈活躍成員 + 當月 records → `calcMonthStats` 排序取前 N → `formatLeaderboard`（複用 stats/leaderboard 相同 scoring 序列）
- [x] 4.9 「破曉王」：同上資料 → `isDawnKing` 篩選 → `formatDawnKing`
- [x] 4.10 「幫助」：`formatHelp(source.type)`（群組/私訊皆可）
- [x] 4.11 組出回覆後呼叫 `replyMessage(replyToken, ...)`；reply 失敗記錄不重試

## 5. 驗證

- [x] 5.1 `npx tsc --noEmit` + `npm run lint` 通過
- [x] 5.2 `openspec validate add-line-bot-commands --strict` 通過
- [x] 5.3 單元驗證純函式：`parseCommand` 各別名/大小寫/標點；`isPublicCommand` 分流；格式化函式對豁免/空清單/未打卡邊界
- [x] 5.4 簽章驗證：偽造錯誤簽章 → 401；正確簽章（用 messaging secret 對 raw body 計算）→ 200
- [ ] 5.5 **端到端（部署後，LINE Console 設好 webhook）**：群組打「排行榜」「破曉王」「幫助」→ 正確公開回覆；群組打「我的狀態」→ 回「請私訊查詢」不含數字
- [ ] 5.6 端到端：私訊打「我的狀態」「今日」「幫助」→ 個人資料正確；未綁定帳號私訊 → 回綁定引導
- [ ] 5.7 LINE Console 部署前置：Messaging channel 設 webhook URL + Enable、關閉「自動回覆訊息」與「歡迎訊息」
