## ADDED Requirements

### Requirement: 歡迎卡（Flex Message）內容
系統 SHALL 提供一張歡迎卡（LINE Flex Message），內容包含黃金八套餐的規則說明與三顆操作按鈕。規則說明 MUST 涵蓋：使用方式概述、每日打卡的時間邊界（中午 12:00 前完成當日簽到）、達標門檻與罰金機制、結算時機。三顆按鈕 MUST 為「參加定課」「完成定課」「個人統計」。

#### Scenario: 歡迎卡含三按鈕與規則
- **WHEN** 系統產生歡迎卡
- **THEN** 卡片內容含規則說明文字與「參加定課」「完成定課」「個人統計」三顆按鈕

---

### Requirement: 加好友自動推歡迎卡
當成員將 bot 加為好友時（LINE `follow` 事件），系統 SHALL 主動推送歡迎卡給該成員。推送失敗 MUST 記錄且不拋例外、不影響其他事件處理，webhook 整體仍回 HTTP 200。

#### Scenario: 新成員加好友
- **WHEN** webhook 收到 `follow` 事件
- **THEN** 系統以 reply token（或該用戶 push）推送歡迎卡

---

### Requirement: 「選單」指令喚出歡迎卡
成員傳「選單」「開始」「menu」（或等義別名）時，系統 SHALL 回覆歡迎卡。此指令 MAY 於群組或私訊使用；於群組回覆時，卡片中的個人統計按鈕行為仍受隱私分流約束（見 postback 需求）。

#### Scenario: 私訊打選單
- **WHEN** 私訊傳「選單」
- **THEN** 回覆歡迎卡

#### Scenario: 群組打選單
- **WHEN** 群組傳「選單」
- **THEN** 回覆歡迎卡（公開內容，不含任何個人數字）

---

### Requirement: 按鈕導向網頁（URI action）
歡迎卡的「參加定課」按鈕 MUST 為 URI action，開啟網站**註冊/登入頁**；「完成定課」按鈕 MUST 為 URI action，開啟網站**打卡頁**。URI MUST 為完整網址（以站台網址推導），MUST NOT 為相對路徑。打卡邏輯 MUST 全留在網頁，MUST NOT 於 LINE 內完成打卡。

#### Scenario: 點參加定課
- **WHEN** 成員點「參加定課」按鈕
- **THEN** 於瀏覽器開啟網站登入/註冊頁

#### Scenario: 點完成定課
- **WHEN** 成員點「完成定課」按鈕
- **THEN** 於瀏覽器開啟網站打卡頁

---

### Requirement: 個人統計按鈕（postback）與隱私分流
歡迎卡的「個人統計」按鈕 MUST 為 postback action。系統收到該 postback 時：於 `user`（一對一）情境 SHALL 回覆該成員個人統計（複用「我的狀態」內容）；於 `group`/`room` 情境 MUST NOT 洩漏個人資料，改回導向私訊的文字（不含任何個人數字）。未綁定 LINE 者 MUST 回覆綁定引導。

#### Scenario: 私訊點個人統計
- **WHEN** `user` 情境收到個人統計 postback，且該 LINE 使用者已綁定成員
- **THEN** 回覆該成員本月完成率、階級、達標與否、（未達標）預估罰金

#### Scenario: 群組點個人統計
- **WHEN** `group`/`room` 情境收到個人統計 postback
- **THEN** 回覆導向私訊文字，不含任何個人數字

#### Scenario: 未綁定點個人統計
- **WHEN** 個人統計 postback 但該 LINE 使用者對應不到成員
- **THEN** 回覆綁定引導連結

---

### Requirement: Webhook 處理 follow 與 postback 事件
系統 SHALL 於 webhook 事件迴圈處理 `follow` 與 `postback` 事件（既有 `message.text` 處理保留）。任一事件處理失敗 MUST 被隔離（記錄、不中斷其他事件），webhook 整體對驗簽通過的請求仍回 HTTP 200。

#### Scenario: 混合事件批次
- **WHEN** 單次 webhook 請求含 `follow`、`postback`、`message` 多種事件
- **THEN** 各事件依型別分派處理，單一事件失敗不影響其餘，整體回 200
