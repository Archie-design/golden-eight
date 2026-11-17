# Proposal

## Why

此群組已合併到其他群組，11/16 起系統僅剩柯啟鴻（M001）一人使用。中午 12:30 的每日摘要目前是「全員狀態摘要」格式（漏卡名單、門檻風險名單、長期缺席摺疊、全月均達成率），這些概念（「N 人完成」「全月均 36%」等群組統計）對單人使用已經失去意義，如截圖所示顯示「1 人完成・全月均 36%」這種不自然的措辭。使用者希望這則中午訊息改為針對他個人的「復盤」：今日打卡狀況 + 跟自己過去比較的分析，作為每天中午檢視昨天表現的依歸。

## What Changes

- `formatDigestMessage` 的輸出內容全面改寫為個人復盤格式，取代現有的全員摘要格式。新內容包含：
  - 今日（剛截止的邏輯日）8 項任務完成狀態與當日得分
  - 本月累計得分、達成率、距目標差
  - 連續打拳天數（`punch_streak`）
  - 今日 vs 上月同一天的達成率對照
  - 今日 vs 歷史累積平均（同一天序）達成率對照
  - 追蹤軌道：沿用既有 `calcPaceStatus` 的近期速度，預估月底達成率
- 移除不再適用的群組概念：漏卡名單、門檻風險名單（四象限）、長期缺席摺疊、「N 人完成·全月均 X%」總結行、狀態變化事件（開始缺卡/回歸/跌破門檻等——這些是跨成員比較事件，單人情境下改用「今日 vs 自己過去」取代）。
- `buildDailySnapshot`、`daily_status_snapshot` 表、冪等寫入/推播機制、CRON_SECRET 驗證、邏輯日推算 MUST 維持不變——這些是本次變更的既有基礎設施，繼續沿用。
- 推播對象維持現狀（僅 M001，已於前次變更完成），本次僅改訊息內容本身。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `daily-status-digest`: 移除「摘要內容與長期缺席摺疊」「狀態變化事件判定」「推播對象與投遞」三條已不適用多人情境的需求（皆附 Reason/Migration），新增「摘要內容與個人復盤呈現」與「單一使用者推播」取代。

## Impact

- **後端**：[lib/daily-status.ts](../../../lib/daily-status.ts)（`formatDigestMessage` 函式簽章與內容重寫；`buildDailySnapshot`/`diffStatusEvents` 的計算邏輯可能仍被內部使用，但輸出呈現方式改變）；[app/api/cron/daily-digest/route.ts](../../../app/api/cron/daily-digest/route.ts)（呼叫端需提供新內容所需的額外資料：上月同天紀錄、歷史累積平均所需的歷史紀錄查詢——可參考既有 `app/api/stats/dashboard/route.ts` 已有的類似查詢模式）。
- **複用**：`lib/scoring.ts` 既有的 `calcMonthStats`、`calcPaceStatus`、`calcDailyRateByDay`、`calcHistoricalAvgDailyRate`，不新增計分邏輯。
- **不影響**：`daily_status_snapshot` 資料表結構、冪等機制、CRON_SECRET 驗證、`getCheckinDayTaipei()`/`getPrevDayStr()` 的邏輯日推算、推播對象（已是 M001 專用）皆不變。
- **向下相容性考量**：目前只有 M001 一人使用系統，若日後群組重新擴編多人使用，此訊息格式將不再適用於多人情境——此為使用者明確要求的範圍限縮，非技術債，但應記錄於程式碼註解供日後參考。
