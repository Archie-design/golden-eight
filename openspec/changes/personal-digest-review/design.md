# Design

## Context

`formatDigestMessage`（[lib/daily-status.ts:169](../../../lib/daily-status.ts)）目前輸出面向多成員的團體摘要：變化事件、漏卡名單、請假名單、門檻風險（四象限）、長期缺席摺疊、全員完成率平均。這些都建立在 `DailyStatus[]`（全員快照陣列）與跨成員比較上。

`app/api/cron/daily-digest/route.ts` 已經在前次變更把推播對象固定為 M001 一人（[route.ts:111-113](../../../app/api/cron/daily-digest/route.ts)），本次只處理訊息內容本身。

`lib/scoring.ts` 已有三個可直接複用、計算「跟自己比較」所需的純函式：`calcMonthStats`（本月累計/達成率/距目標）、`calcPaceStatus`（已經被現有程式碼用於「門檻風險」計算，回傳 `{ pace, projRate, quadrant }`，對單人一樣適用，只是改變呈現方式不再篩選象限）、`calcDailyRateByDay`/`calcHistoricalAvgDailyRate`（dashboard 折線圖已經在用，同樣的日序比對邏輯直接適用於「今日 vs 上月同天」「今日 vs 歷史累積平均」）。

見 proposal.md - Why / What Changes；規格見 `specs/daily-status-digest/spec.md`。

## Goals / Non-Goals

**Goals:**
- 把 `formatDigestMessage` 改寫為單人復盤格式，複用 `lib/scoring.ts` 既有函式，不新增計分邏輯
- `route.ts` 只需新增「上月同天 + 歷史紀錄」的查詢，查詢形狀比照 `app/api/stats/dashboard/route.ts` 既有的 `lastMonthDailyRates`/`historicalAvgDailyRates` 查詢模式
- `daily_status_snapshot` 表結構、冪等寫入/推播機制、CRON_SECRET 驗證、`buildDailySnapshot` 的快照計算（`missed`/`miss_streak`/`is_leave` 等欄位）全部維持不變——這些跟「訊息呈現格式」是正交的，不需要為了改訊息格式去動快照寫入邏輯

**Non-Goals:**
- 不刪除 `diffStatusEvents`、`buildDailySnapshot` 等函式本身（程式碼保留，供日後若群組擴編多人使用時可直接恢復呼叫）；僅訊息格式不再呼叫 `diffStatusEvents` 的輸出
- 不改變 `daily_status_snapshot` 的欄位或 schema
- 不處理「如果日後又變回多人群組」的切換機制（例如依成員數自動切換格式）——目前就是單人情境，這次直接寫死單人格式，日後若情境改變再另外規劃

## Decisions

### 1. `formatDigestMessage` 改為單人參數簽章，不再接收 `DailyStatus[]` 陣列
**選擇**：函式簽章從「全員陣列 + events」改為單一成員的資料：`today`（今日打卡狀態與 `punch_streak`）、`monthStats`（`calcMonthStats` 回傳值）、`paceStatus`（`calcPaceStatus` 回傳值）、`lastMonthRate`（上月同一天的達成率，可為 `null`）、`historicalAvgRate`（歷史累積平均同一天的達成率，可為 `null`）、`isLeave`/`leaveReason`。

**理由**：現有簽章的 `snapshot: DailyStatus[]`、`membersById`、`recordsByMember` 等參數都是為了「跨成員迴圈」設計，單人情境下這些集合操作全部多餘；改成單一成員的具名參數讓函式讀起來直接對應復盤內容的每一項，也讓呼叫端 `route.ts` 的資料準備更直觀（不用為了湊陣列形狀而包一層）。

**替代方案考慮**：維持陣列簽章、內部只處理一個元素——保留了不必要的複雜度（迴圈、`longIds`/`atRisk` 之類的集合計算在單元素情境下是多餘的空轉），不採用。

### 2. 「今日 vs 上月同天」直接查上月同一天的單筆記錄，不透過 `calcDailyRateByDay`
**選擇**：`route.ts` 直接查 `checkin_records`（`member_id = M001`, `date = 上月同一天`）取得單筆 `total_score`（或 `null` 代表無紀錄），換算成達成率百分比（`score / 8 * 100`）。

**理由**：`calcDailyRateByDay` 是為了「整月序列」設計（回傳 `{ day, rate }[]`），這裡只需要單一天的值，直接查詢單筆更直接；不需要為了複用函式而多查一整月份再從陣列中挑一個元素。

**替代方案考慮**：複用既有 `app/api/stats/dashboard/route.ts` 裡上個月整月查詢後再用 `calcDailyRateByDay` 取出單日——這是給折線圖用的查詢粒度（整月），對只需要單一天數值的場景是不必要的資料量，不採用。

### 3. 「今日 vs 歷史累積平均」複用 `calcHistoricalAvgDailyRate`，查詢範圍比照既有 dashboard 的回溯上限
**選擇**：`route.ts` 查詢柯啟鴻起算日到上月月底為止的歷史 `checkin_records`（`date, total_score`），呼叫 `calcHistoricalAvgDailyRate` 取得依日序分桶的平均，再從回傳陣列中取出「今日對應日序」的那一筆。查詢範圍沿用 `app/api/stats/dashboard/route.ts` 既有的 `HISTORICAL_AVG_LOOKBACK_MONTHS`（12 個月）回溯上限，避免隨使用時間拉長而查詢量無上限增長。

**理由**：這個函式與回溯上限的設計已經在 dashboard 折線圖驗證過，直接複用同一套計算與資料量控管策略，不重新發明。

### 4. 追蹤軌道（pace）：複用既有 `calcPaceStatus` 呼叫，但不再篩選象限
**選擇**：`route.ts` 繼續呼叫 `calcPaceStatus`（跟現有程式碼在「門檻風險」區塊的呼叫方式完全相同），但訊息呈現不再只挑 `rescue`/`lukewarm` 象限才顯示——單人情境下，不論是哪個象限都直接顯示 `pace`/`projRate`/`quadrant`，讓使用者每天都看得到自己的追蹤軌道，而不是只在「有風險」時才出現。

**理由**：原本的「只顯示有風險的人」設計是為了管理員篩選「誰需要關注」，單人情境下使用者看自己的摘要，不需要被篩選——每天都想看到自己的完整追蹤軌道數字，不論好壞。

## Risks / Trade-offs

- **[風險] `formatDigestMessage` 簽章改變是破壞性變更** → 可接受：此函式唯一呼叫端是 `app/api/cron/daily-digest/route.ts`，屬於本次變更範圍內的檔案，一併修改呼叫端即可，沒有其他程式碼依賴舊簽章。
- **[風險] 保留但不再呼叫的 `diffStatusEvents`/`buildDailySnapshot` 多人邏輯可能隨時間推移變成死碼，日後難以確認是否還正確** → 可接受：`buildDailySnapshot` 仍被呼叫（快照寫入邏輯不變，只是訊息格式不呈現事件），只有 `diffStatusEvents` 的呼叫與其輸出的使用被移除；若日後真的需要恢復多人模式，屆時應重新檢視一次邏輯是否仍符合需求，而非假設直接恢復呼叫就沒問題。
- **[Trade-off] 不做「依成員數自動切換格式」的通用機制** → 可接受：這是使用者明確要求的範圍限縮（目前就是單人），過度設計一個「自動偵測人數切換格式」的機制超出本次需求，且會讓程式碼複雜度不成比例地增加。
