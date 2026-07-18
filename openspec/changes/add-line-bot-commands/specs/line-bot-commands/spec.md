## ADDED Requirements

### Requirement: LINE Webhook 接收與簽章驗證
系統 SHALL 提供 `POST /api/line/webhook` 端點接收 LINE Messaging API 的 webhook 事件。系統 MUST 以 Messaging channel 的 `LINE_CHANNEL_SECRET` 對請求原始 body 計算 HMAC-SHA256 並 Base64，與 `x-line-signature` 標頭比對，驗證失敗 MUST 回 HTTP 401 且不處理事件。系統 MUST 對驗證通過的請求一律回 HTTP 200（即使個別事件無對應指令），以免 LINE 平台重送。

#### Scenario: 簽章有效
- **WHEN** 收到 webhook 請求且 `x-line-signature` 與以 body + channel secret 計得的簽章相符
- **THEN** 系統處理其中的訊息事件並回 HTTP 200

#### Scenario: 簽章無效
- **WHEN** `x-line-signature` 缺失或與計算結果不符
- **THEN** 系統回 HTTP 401，不解析、不回覆任何訊息

#### Scenario: 非文字或非訊息事件
- **WHEN** 事件為非 `message` 類型，或訊息非 `text` 類型（貼圖、圖片、follow/join 等）
- **THEN** 系統略過該事件、不回覆，整體仍回 HTTP 200

---

### Requirement: 指令解析與回覆
系統 SHALL 將成員傳入的文字訊息正規化（去前後空白、全形轉半形視需要）後對應到已支援指令，並以該事件的 `replyToken` 透過 `/v2/bot/message/reply` 回覆。回覆 MUST 使用 reply token（不計推播額度），MUST NOT 改用 push。無法對應到任何已支援指令的文字 MUST NOT 回覆（避免干擾群組聊天）。

#### Scenario: 對應到已支援指令
- **WHEN** 訊息文字經正規化後等於某支援指令（如「排行榜」）
- **THEN** 系統以 `replyToken` 回覆該指令對應的資料

#### Scenario: 非指令文字
- **WHEN** 訊息文字不對應任何支援指令
- **THEN** 系統不回覆（靜默略過），不消耗 reply

#### Scenario: reply token 已失效
- **WHEN** 回覆時 `replyToken` 已過期或已用過（LINE 回錯誤）
- **THEN** 系統記錄錯誤並結束，MUST NOT 靜默改用 push 補發

---

### Requirement: 群組與私訊的隱私分流
系統 SHALL 依事件來源型別（`source.type` 為 `user` / `group` / `room`）限制可回覆的指令集。個人隱私資料（個人分數、罰金、成就、今日逐項打卡狀態）MUST NOT 於 `group` / `room` 來源回覆。公開資料（排行榜名次、破曉王候選、幫助）MAY 於任一來源回覆。

#### Scenario: 群組查公開指令
- **WHEN** 來源為 `group` 或 `room`，指令為「排行榜」「破曉王」或「幫助」
- **THEN** 系統回覆對應公開資料

#### Scenario: 群組查個人指令
- **WHEN** 來源為 `group` 或 `room`，指令為「我的狀態」或「今日」
- **THEN** 系統不在群組洩漏個人資料，改以文字引導成員私訊 bot 查詢（回覆不含任何分數／罰金數字）

#### Scenario: 私訊查個人指令
- **WHEN** 來源為 `user`（一對一），指令為「我的狀態」或「今日」
- **THEN** 系統回覆該成員的個人資料

---

### Requirement: 成員身分對應與未綁定引導
需要個人資料的指令，系統 MUST 以事件 `source.userId` 對應 `members.line_user_id` 取得成員。對應不到成員（未綁定 LINE）時，系統 MUST 回覆綁定引導（含綁定連結或步驟說明），MUST NOT 靜默、MUST NOT 回錯誤堆疊。公開指令不需成員對應。

#### Scenario: 已綁定成員查個人資料
- **WHEN** 私訊個人指令且 `source.userId` 對應到一位成員
- **THEN** 系統回覆該成員資料

#### Scenario: 未綁定者查個人資料
- **WHEN** 私訊個人指令但 `source.userId` 對應不到任何成員
- **THEN** 系統回覆綁定引導連結／步驟，提示先完成 LINE 綁定

---

### Requirement: 「我的狀態」指令
在私訊情境，成員傳「我的狀態」（或等義別名）時，系統 SHALL 回覆該成員**本月**的：完成率、目前階級、是否達標、預估罰金（未達標時）、距達標尚需完成天數（可估算時）。新進不參與計分的成員（本月豁免）MUST 回覆「本月新進，不參與計分」而非 0%／罰金。

#### Scenario: 一般成員查本月狀態
- **WHEN** 已綁定成員私訊「我的狀態」
- **THEN** 回覆含本月完成率、階級、達標與否、（未達標）預估罰金

#### Scenario: 本月豁免成員查狀態
- **WHEN** 該成員本月 `effective_start_date` 使其不參與計分
- **THEN** 回覆「本月新進，不參與計分」，不顯示 0% 或罰金

---

### Requirement: 「今日」指令
在私訊情境，成員傳「今日」（或等義別名）時，系統 SHALL 依當前**邏輯打卡日**（`getCheckinDayTaipei()`，noon 邊界）回覆該日 8 項任務逐項的已打／未打狀態，並提示尚未完成的項目。當日尚未打卡則回覆「今日尚未打卡」與提醒。

#### Scenario: 今日已部分打卡
- **WHEN** 已綁定成員私訊「今日」，該邏輯日已有打卡紀錄
- **THEN** 回覆 8 項逐項狀態並標示尚未完成項目

#### Scenario: 今日尚未打卡
- **WHEN** 該邏輯日無打卡紀錄
- **THEN** 回覆「今日尚未打卡」與提醒去打卡

---

### Requirement: 「排行榜」指令
成員傳「排行榜」（或等義別名）時，系統 SHALL 回覆本月完成率前段名次（預設前 N 名，以成員名稱與完成率呈現）。此為公開資料，MAY 於群組或私訊回覆。

#### Scenario: 查排行榜
- **WHEN** 任一來源傳「排行榜」
- **THEN** 回覆本月前 N 名成員名稱與完成率

---

### Requirement: 「破曉王」指令
成員傳「破曉王」（或等義別名）時，系統 SHALL 回覆目前符合破曉王條件（`isDawnKing`）的候選成員名單。此為公開資料，MAY 於群組或私訊回覆。

#### Scenario: 有破曉王候選
- **WHEN** 任一來源傳「破曉王」且有成員符合條件
- **THEN** 回覆候選成員名單

#### Scenario: 尚無破曉王候選
- **WHEN** 目前無成員符合破曉王條件
- **THEN** 回覆「目前尚無破曉王候選」

---

### Requirement: 「幫助」指令
成員傳「幫助」「?」「？」（或等義別名）時，系統 SHALL 回覆可用指令清單與各自用途說明。清單 MUST 依來源標示哪些指令僅限私訊（個人資料），使成員知道在群組與私訊分別能用什麼。

#### Scenario: 群組查幫助
- **WHEN** 來源為 `group` / `room` 傳「幫助」
- **THEN** 回覆指令清單，標示個人資料指令需私訊 bot

#### Scenario: 私訊查幫助
- **WHEN** 來源為 `user` 傳「幫助」
- **THEN** 回覆完整指令清單（含個人與公開指令）
