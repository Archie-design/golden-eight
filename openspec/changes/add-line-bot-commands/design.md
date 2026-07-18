## Context

專案的 LINE 能力目前**只有推播（單向）**：`lib/line-push.ts` 用 Messaging channel 的 `LINE_CHANNEL_ACCESS_TOKEN` 打 `/v2/bot/message/push`，由 cron（daily-digest）主動發。**沒有任何 webhook 接收管道**——`app/api/` 下的 LINE route 全是 auth/OAuth 綁定（`app/api/auth/line/*`），不是 Messaging webhook。

要讓學員在群組／私訊打指令拿數據，必須新建接收側：webhook route + 簽章驗證 + 指令解析 + reply 回覆。

探索確認的可複用資產：
- **成員身分對應**：`members.line_user_id`（已有唯一索引），OAuth 綁定流程已把 `profile.userId` 寫入（`app/api/auth/line/callback/route.ts:121`）。webhook 事件的 `source.userId` 與此為**同一 Provider 下同一 userId**（現行 Login/Messaging 已在同一 Provider，先前 bot 遷移已確保）。
- **數據計算**：`lib/scoring.ts` 已有 `calcMonthStats`、`isDawnKing`、`calcPenalty`、`expectedCheckinDays`；`app/api/stats/leaderboard/route.ts` 已示範「當月即時排行榜 + 破曉王」的完整撈法（活躍成員 → 當月 records → `calcMonthStats` → 排序），`app/api/cron/daily-digest/route.ts` 示範「豁免判斷 + 邏輯日邊界」。
- **時間邊界**：`getCheckinDayTaipei()`（noon 邊界）、`getMonthEnd()`、`getYearMonth()`。
- **綁定連結**：`GET /api/auth/line/login` 產生 OAuth URL；未綁定引導可回站台 dashboard 綁定頁的公開連結，或直接給登入頁 URL。

## Goals / Non-Goals

**Goals:**
- 新增可驗簽的 LINE webhook 端點，安全接收 Messaging 事件。
- 支援 5 指令：我的狀態、今日、排行榜、破曉王、幫助。
- 嚴格隱私分流：個人資料只在私訊回，群組只回公開資料。
- 未綁定者得到綁定引導，而非靜默或報錯。
- 回覆走 reply token（免費、不佔每月推播額度）。

**Non-Goals:**
- 不做多輪對話 / 狀態機（每則指令無狀態、即問即答）。
- 不做模糊語意 / NLP，只做關鍵字對應（含少量別名）。
- 不改計分、schema、既有 cron 推播。
- 不做「群組內直接顯示他人個人資料」——隱私邊界明確禁止。
- 不做管理員專屬指令（本次僅學員自助查詢；管理指令可另議）。

## Decisions

### 決策 1：新建 `POST /api/line/webhook`，手動驗簽（不引入 LINE SDK）
- LINE webhook 簽章 = `Base64(HMAC-SHA256(channelSecret, rawBody))`，比對 `x-line-signature`。用 Node `crypto` 即可，**不需引入 `@line/bot-sdk`**（減依賴、與現有 `line-push.ts` 手刻 fetch 風格一致）。
- **關鍵：需要 raw body** 才能算簽章。Next.js App Router route handler 用 `await req.text()` 取得原始字串後：先驗簽，再 `JSON.parse`。切勿先 `req.json()` 再 stringify（可能與原始位元組不符導致簽章不符）。
- 驗簽失敗 → 401。驗簽成功但事件無對應指令 → 仍回 200（避免 LINE 平台判定失敗而重送）。
- **簽章用的 secret 是 Messaging channel 的 `LINE_CHANNEL_SECRET`**。現有 `LINE_CHANNEL_SECRET` 是 Login channel 的——**這是坑**：見「風險」與 tasks，需確認環境變數對到 Messaging channel，或新增獨立變數。

### 決策 2：`lib/line-commands.ts` 純函式解析 + 組裝
```
webhook route（薄）
  ├─ 讀 raw body → 驗簽 → parse events
  └─ 對每個 message.text 事件：
       parseCommand(text)  → { kind: 'my_status'|'today'|'leaderboard'|'dawn_king'|'help'|null }
       依 source.type 過濾（群組不放行個人指令）
       需個人資料者：line_user_id → member（撈 DB）
       組回覆文字（呼叫 scoring）
       replyMessage(replyToken, [{type:'text',text}])
```
- 解析、隱私分流判斷、文字組裝儘量做成**純函式**（吃資料、吐字串），DB/fetch 留在 route，便於單測與推理。
- 指令正規化：`trim()` + 去除頭尾標點；比對關鍵字集合含別名（「我的狀態」「狀態」「我的進度」；「今日」「今天」；「排行榜」「排名」；「破曉王」；「幫助」「help」「?」「？」）。
- **非指令文字一律不回**（回傳 `kind: null` → route 略過），避免群組聊天被 bot 洗版。

### 決策 3：隱私分流以 `source.type` 為唯一依據
- `source.type === 'user'` → 允許個人 + 公開指令。
- `source.type === 'group' | 'room'` → **只允許公開指令**（排行榜／破曉王／幫助）。個人指令在群組 → 回一句「請私訊我查詢個人資料」（不含任何數字）。
- 個人資料回覆前，route MUST 再次確認 `source.type === 'user'`（防呆：即使 parse 放行，實際查詢前再擋一層）。

### 決策 4：資料查詢複用既有計算，不另立來源
- **排行榜／破曉王**：複用 `app/api/stats/leaderboard` 的當月即時算法——撈活躍成員 + 當月 records → `calcMonthStats` 排序、`isDawnKing` 篩選。為避免與該 route 邏輯漂移，抽共用 helper（如 `lib/leaderboard.ts` 或就地複用 `scoring` 組合）；本次以「在 line-commands 內以相同 scoring 呼叫序列」實作，範圍最小。
- **我的狀態**：單一成員 `calcMonthStats` + `calcPenalty`；豁免（`effective_start_date` 使本月不計分）回「本月新進，不參與計分」。
- **今日**：以 `getCheckinDayTaipei()` 取邏輯日，撈該成員該日 `checkin_records.tasks[8]`，逐項對照 `TASKS`（`lib/constants.ts`）。

### 決策 5：回覆用 reply token（免費），不用 push
- `lib/line-push.ts` 增補 `replyMessage(replyToken, messages)` → `POST /v2/bot/message/reply`。reply **不計入每月 200 則推播額度**（LINE 只計 push/broadcast/multicast）。
- reply token 有時效且一次性；失效即記錄錯誤結束，**不 fallback 改用 push**（push 才耗額度、且需知道 to）。

### 決策 6：未綁定引導回登入／綁定連結
- 需個人資料但 `line_user_id` 對不到成員 → 回覆固定文案 + 綁定連結（站台網址 `/dashboard`，引導以 LINE 登入綁定；或 `/api/auth/line/login` 產生的 OAuth 起點）。用站台既有綁定流程，不新增綁定機制。

## Risks / Trade-offs

- **[最大坑] `LINE_CHANNEL_SECRET` 目前是 Login channel 的，webhook 驗簽需要 Messaging channel 的 secret**。若沿用會導致所有簽章驗證失敗（全部 401）。→ tasks 明列：確認 Messaging channel secret，需要時新增 `LINE_MESSAGING_CHANNEL_SECRET` 環境變數，webhook 用它、OAuth 仍用 `LINE_CHANNEL_SECRET`。上線前 MUST 用真實事件驗簽通過。
- **[raw body 驗簽]** App Router 若中介層改寫 body 會破壞簽章。→ route 內 `req.text()` 取原始字串、先驗再 parse；不經 `req.json()`。
- **[LINE Console 設定]** 需在 Messaging API channel 開 webhook、填 URL、**關閉「自動回覆訊息」**（否則官方帳號會用預設罐頭訊息蓋掉），並允許 webhook。這些是 Console 手動步驟，非程式碼——tasks 列為部署前置。
- **[群組隱私誤洩]** 若分流判斷有誤會在群組洩漏個人數字。→ 雙重防線：parse 層 + 查詢前再確認 `source.type`；spec scenario 卡住「群組查個人指令不含數字」。
- **[reply token 時效]** 事件處理若太慢（如同步大量 DB 查詢）reply token 可能過期。→ 查詢輕量、單一成員／單月，風險低；排行榜撈全員但仍為單月單查。
- **[群組成員未綁定但查公開指令]** 公開指令不需 member 對應，直接回，無此問題。
- **[未加官方帳號好友者私訊]** 理論上未加好友無法私訊 bot；群組情境 reply 用 token 不需好友關係，OK。

## Migration Plan

- 純新增接收側：`app/api/line/webhook/route.ts` + `lib/line-commands.ts` + `lib/line-push.ts` 增補 `replyMessage`。無 schema、無資料遷移。
- **部署前置（LINE Console，手動）**：
  1. Messaging API channel → 設 Webhook URL = `https://<host>/api/line/webhook`、Verify、Enable webhook。
  2. 關閉「自動回覆訊息」「加入好友的歡迎訊息」（避免罐頭訊息干擾）。
  3. 確認 webhook 驗簽用的 secret = Messaging channel 的 secret，寫入對應環境變數（本地 `.env.local` + Vercel）。
- 回滾：移除 route + lib 函式 + Console 關閉 webhook 即可，無殘留狀態。
- 上線後以「在群組打『排行榜』、私訊打『我的狀態』」端到端驗證各一次。

## Open Questions

- 排行榜顯示前幾名（N=?）與是否顯示完成率數字——預設前 5、顯示百分比，可依觀感調。
- 「我的狀態」是否要附「距達標尚需 X 天」——需 `expectedCheckinDays` 反推，能算則附，估不出則略過，不阻擋主功能。
- 是否要加管理員專屬指令（如「全員風險名單」）——本次 Non-Goal，視需求另開 change。
- 指令別名集合是否夠涵蓋成員自然說法——上線後看實際輸入再補。
