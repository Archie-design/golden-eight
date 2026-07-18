## 1. Flex 訊息型別與 push/reply 放寬（lib/line-push.ts）

- [x] 1.1 於 `lib/line-push.ts` 新增 `LineFlexMessage` 型別（`{ type:'flex'; altText:string; contents:object }`）與 `LineMessage = LineTextMessage | LineFlexMessage` 聯集
- [x] 1.2 放寬 `replyMessage` 的 `messages` 參數型別為 `LineMessage[]`；確認既有 text 呼叫仍合法
- [x] 1.3 放寬 `pushTextToUsers`（或新增 `pushFlex`）以支援 follow 情境送 Flex；不破壞 daily-digest 既有純文字推播

## 2. 歡迎卡組裝（lib/line-flex.ts，純函式）

- [x] 2.1 新增 `lib/line-flex.ts`：`buildWelcomeFlex(siteUrl)` 回傳 `LineFlexMessage`（bubble 結構）
- [x] 2.2 卡片 body：黃金八套餐規則說明（使用方式、12:00 打卡邊界、達標門檻與罰金、結算時機）——用實際規則，非照抄截圖數字
- [x] 2.3 卡片 footer 三按鈕：參加定課 `uri:${siteUrl}/`、完成定課 `uri:${siteUrl}/checkin`、個人統計 `postback data:'action=my_stats' displayText:'個人統計'`
- [x] 2.4 `altText` 設為「定課小幫手選單」等（未支援 Flex 的環境顯示用）

## 3. 「選單」指令（lib/line-commands.ts）

- [x] 3.1 `parseCommand` 新增別名：`選單 / 主選單 / 開始 / menu` → 新 kind `'menu'`
- [x] 3.2 `isPublicCommand('menu')` 回 true（卡片本身公開；個人按鈕自帶隱私分流）
- [x] 3.3 `CommandKind` 型別加入 `'menu'`

## 4. Webhook 事件擴充（app/api/line/webhook/route.ts）

- [x] 4.1 `LineEvent` 型別加 `postback?: { data: string }`；事件迴圈依 `ev.type` 分派 message / follow / postback
- [x] 4.2 `follow` 事件：以 `replyToken` reply 歡迎卡（`buildWelcomeFlex(siteUrl)`）；失敗隔離、整體回 200
- [x] 4.3 `message.text` 且 `kind==='menu'`：reply 歡迎卡（群組/私訊皆可）
- [x] 4.4 `postback` 事件：解析 `data`；`action=my_stats` → 走與「我的狀態」相同路徑（source.type 分流 + line_user_id 綁定檢查 + 未綁定引導）
- [x] 4.5 站台網址推導沿用既有 `bindUrl()` 的 origin 邏輯，抽共用 `siteOrigin()` 供 Flex 按鈕與綁定引導共用

## 5. 驗證

- [x] 5.1 `npx tsc --noEmit` + `npm run lint` 通過
- [x] 5.2 `openspec validate add-line-welcome-menu --strict` 通過
- [x] 5.3 單元驗證純函式：`buildWelcomeFlex` 三按鈕 type/uri/data 正確、altText 存在；`parseCommand('選單')==='menu'`、`isPublicCommand('menu')===true`
- [ ] 5.4 Flex 結構以 LINE Flex Simulator 或實送確認可正常渲染（無欄位錯誤）
- [ ] 5.5 **端到端（部署後）**：加 bot 好友 → 自動收到歡迎卡；打「選單」→ 收到卡
- [ ] 5.6 端到端：點「參加定課」開網頁登入/註冊頁；點「完成定課」開打卡頁；點「個人統計」私訊回個人資料
- [ ] 5.7 端到端隱私：群組點「個人統計」→ 回導向私訊、不含數字；未綁定點 → 回綁定引導
- [ ] 5.8 LINE OA Manager：確認關閉「加入好友的歡迎訊息」（避免與歡迎卡重複）
