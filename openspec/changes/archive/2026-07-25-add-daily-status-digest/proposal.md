## Why

管理員目前無法主動掌握學員狀態——所有問題都是「學員來敲、或剛好瞄到截圖」才浮現（工時扣分異常、階梯罰金算錯、成員自稱有打卡但 DB 沒有）。後台是查詢介面：得先起疑才查得到，但起疑本身沒有來源。

同時 `/api/cron/daily-reminder` 每天 06:00 已經算出「誰沒打卡、距目標差幾分」，卻只 `console.log` 就丟棄（`route.ts:59-61` 的 TODO），沒有任何人看得到。這支 cron 目前在做白工。

另一個結構性缺口：每月達成率只有月結時的單一終值，沒有「這個人是怎麼一步步掉下去的」軌跡。月中沒人（含學員自己）看得出快掉出門檻，等月結出來罰款已成定局，只能事後爭議。

## What Changes

- 新增 `daily_status_snapshot` 表：每日記錄每位活躍成員的當日狀態事實（是否漏卡、連續缺卡天數、當下達成率與是否達標）。**快照為唯讀事實，不因日後補登/月結/重跑而重算**，與 `monthly_summary.level` 同一防污染哲學。
- 新增 cron `/api/cron/daily-digest`，排程 **12:30 Taipei**（邏輯日 12:00 截止後 30 分鐘 buffer，對齊月結 cron 的設計原則）：
  1. 對剛截止的邏輯日 `D = getCheckinDayTaipei() - 1` 計算全員狀態
  2. 寫入 `daily_status_snapshot[D]`
  3. 與 `snapshot[D-1]` 比對，產生「狀態變化事件」
  4. 組成摘要並經 LINE Messaging API 推播給管理員
- 摘要採**「狀態為主 + 變化標記」**：完整呈現當日漏卡與門檻風險，但用 ⚡ 標出當日才發生的變化；連續缺卡達門檻者摺疊為「長期缺席 N 人」單行，避免長期未打卡者每日洗版導致告警疲乏。
- 推播對象為 `is_admin = true` 且已綁定 LINE 的成員（目前 3 位，全員已綁定）。**不排除管理員自己的學員狀態**——管理員同時是學員，其漏卡與風險照常列入。
- **BREAKING**：`/api/cron/daily-reminder`（06:00）的職責由本變更取代。既有 cron 保留或移除由 design 決定。
- 新增 env `LINE_CHANNEL_ACCESS_TOKEN`（Messaging API push 用；現有 `LINE_CHANNEL_ID/SECRET` 為 Login channel，用途不同）。

## Capabilities

### New Capabilities
- `daily-status-digest`: 每日狀態快照的產生與留存、狀態變化事件判定、管理員摘要推播。涵蓋邏輯日邊界處理、新進豁免排除、冪等重跑、長期缺席摺疊。

### Modified Capabilities
<!-- 無。admin-console 的後台 UI 不變；daily-checkin 的打卡行為不變。 -->

## Impact

- **新表**：`daily_status_snapshot`（migration + `schema.sql`）。
- **新 cron**：`app/api/cron/daily-digest/route.ts` + `vercel.json` 排程（`30 4 * * *` UTC = 12:30 Taipei）。
- **既有 cron**：`app/api/cron/daily-reminder/route.ts` 職責被取代。
- **新 lib**：狀態快照計算與變化判定（純函式，可測）；LINE push client。
- **環境變數**：新增 `LINE_CHANNEL_ACCESS_TOKEN`。
- **既有邏輯複用**：`getCheckinDayTaipei`（邏輯日）、`calcMonthStats`（rate/remaining/targetScore）、`effective_start_date` 豁免判定（與工時分母同源）。
- **不影響**：打卡、計分、月結、罰款計算、後台既有頁面。本變更為唯讀觀測 + 推播。
- **後續鋪路**：推播管道與訊息格式先以管理員（3 人）驗證，為未來推播給全體學員（目前 LINE 綁定率 10/20）的前置。
