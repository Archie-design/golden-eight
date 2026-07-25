## Context

打卡頁（`app/(main)/checkin/page.tsx`）已顯示「本日日出 {sunrise}，建議開始打拳時間為 {punchStart}」（L234），資料由 `/api/checkin/today` 回傳。建議打拳 = 日出 + 12 分（`getPunchStartTime` in `lib/sunrise.ts`，截圖 05:13 + 12 = 05:25 印證）。

破曉打拳前建議睡滿六小時，需由建議打拳時間往回推「建議入睡時間」。積木齊備：
- `lib/sunrise.ts` 的 `addMinutes(hhmm, minutes)` 已支援負數（`(total/60)%24`、`total%60` 對負數 wrap，經驗算 05:25 −380 = 23:05）。
- `getPunchStartTime` 已回建議打拳字串。
- `sunrise`、`punchStart` 已從 API 帶進 checkin page（L22–23）。

驗算：任何合理日出（打拳 04:30–06:00），往回推 380 分皆落在前一晚 22:xx–23:xx → 「前一晚」標示恆成立，無須動態判斷當天/前一晚。

## Goals / Non-Goals

**Goals:**
- 由建議打拳時間往回推 −20 分 −6 小時，得建議入睡時間。
- 跨午夜正確（wrap 到前一日時分）。
- 明確標「前一晚」，接於建議打拳時間後同卡片顯示。

**Non-Goals:**
- 不改打卡驗證（早睡早起既有規則不變）、不改計分、不改 schema。
- 不做「你昨晚幾點睡」的實績比對（無此資料）。
- 不做個人化睡眠時長（統一 6 小時）。
- 不做推播提醒（純頁面呈現）。

## Decisions

### 決策 1：基準為建議打拳時間（日出+12），非日出
往回推的起點是畫面已顯示的建議打拳時間（`punchStart` = 日出+12），與需求原話「用建議打拳時間往回推」一致，也與使用者可見數字對齊。−20 分（打拳前緩衝）−360 分（6 小時）= −380 分。

### 決策 2：以 addMinutes 負數計算，恆標「前一晚」
`getSuggestedSleepTime(dateStr)` = `addMinutes(await getPunchStartTime(dateStr), -380)`。`addMinutes` 已正確處理負數 wrap。因驗算顯示入睡恆為前一晚，顯示文字固定加「前一晚」前綴，不需動態判斷跨日天數（簡化）。

### 決策 3：常數化推算分鐘
於 `lib/sunrise.ts`（或 constants）明列 `SLEEP_BUFFER_MIN = 20`、`SLEEP_HOURS = 6`，避免 magic number，日後可調（如改睡 7 小時）。

### 決策 4：呈現接於打拳時間後
checkin page L234 文字後加「｜建議前一晚 {suggestedSleep} 前入睡」。任務描述（L450）視需要同步；本次以主資訊區（L234）為準，最小侵入。

## Risks / Trade-offs

- **[誤解為當天晚上]** 若不標前一晚，學員可能以為當天 23:05 就寢。→ 固定「前一晚」前綴 + spec scenario 卡住。
- **[日出 fallback 06:00 時的入睡]** 日出 API 失敗 fallback 06:00 → 打拳 06:12 → 入睡 23:52（仍前一晚），合理，不需特殊處理。
- **[6 小時是否足夠]** 屬健康建議範疇，非技術問題；統一 6 小時、常數化可調。
- **[跨午夜 wrap 正確性]** addMinutes 負數已驗算；單測覆蓋 05:25→23:05 等案例。

## Migration Plan

- 純衍生時間 + 呈現：`lib/sunrise.ts` 加 `getSuggestedSleepTime`、`/api/checkin/today` 回 `suggestedSleep`、`checkin/page.tsx` 加一句。無 schema、無資料遷移。
- 回滾：移除函式 + API 欄位 + 前端字句即可。
- 驗證：單測 addMinutes 負數/跨午夜；手動於打卡頁確認顯示「建議前一晚 HH:MM 前入睡」且時間正確。

## Open Questions

- 睡眠時長 6 小時、緩衝 20 分是否要做成可調設定（管理端）——本次常數化即可，設定化視需求另議。
- 是否也在「早睡早起」任務描述同步顯示入睡建議——本次先做主資訊區，任務描述視反饋再加。
