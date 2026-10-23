# Daily Check-in Capability

## Purpose

成員每日完成 8 項任務並打卡記錄。打卡邏輯日以台北時間 12:00 為邊界（中午前提交歸入前一日），確保跨日打卡情境的合理歸屬。系統計算當日得分、累計連續打拳天數、提交當下解鎖之成就，並支援當日打卡的修改（含成就對帳與稽核軌跡）。

## Requirements

### Requirement: 八項每日任務定義
系統 SHALL 提供 8 項固定任務，每項 1 分，最高 8 分／天：

| # | 任務 | 說明 |
|---|------|------|
| 1 | 早睡早起 | 12 前入睡、早上 7 前起床 |
| 2 | 破曉打拳 | 日出後建議開始時間（有連續天數統計） |
| 3 | 丹氣跑步 15 分鐘 | 雨天可室內 |
| 4 | 曬太陽 | 陰雨天不計分 |
| 5 | 工作 8 小時 | 依實際工時填寫（含假日）；月累計納入工時補扣 |
| 6 | 不吃肉 | 各素食級別皆可 |
| 7 | 寫觀心書 | 一階可寫覺察日記 |
| 8 | 淨心功法 | 睡前效果更好 |

8 項任務的順序與定義 MUST 與 `lib/constants.ts` 中 `TASKS` 陣列一致，作為單一真相來源。

#### Scenario: 八項任務作為 boolean[8]
- **WHEN** 成員提交打卡 `tasks` 陣列
- **THEN** 陣列長度必為 8，索引 0–7 對應上表 # 1–8

---

### Requirement: 打卡邏輯日 12:00 邊界
打卡邏輯日 SHALL 以台北時間 12:00 為邊界。`getCheckinDayTaipei()` 在 12:00 前回傳「昨日」，12:00 後回傳「今日」。所有打卡寫入、查詢、成就連續性判斷 MUST 以此邏輯日為基準（而非日曆日）。

#### Scenario: 中午前提交
- **WHEN** 4/21 10:00 提交打卡
- **THEN** `checkin_records.date` 寫入 `2026-04-20`

#### Scenario: 中午後提交
- **WHEN** 4/21 12:01 提交打卡
- **THEN** `checkin_records.date` 寫入 `2026-04-21`

---

### Requirement: 提交打卡
`POST /api/checkin/submit` SHALL 接受 `{ tasks: boolean[8], note?, work_hours? }`，計算 `base_score = calcBaseScore(tasks)`，`punch_bonus` 固定為 0，`total_score = base_score`。系統 MUST 同時更新 `punch_streak`（當日截止連續打拳天數）。已有當日邏輯日記錄者 MUST 拒絕重複提交。

#### Scenario: 首次提交當日打卡
- **WHEN** 成員當日邏輯日尚無記錄，提交 `tasks`
- **THEN** `checkin_records` 寫入新列，回傳 `{ ok, totalScore, baseScore, punchStreak, newAchievements[] }`

#### Scenario: 重複提交
- **WHEN** 成員當日邏輯日已有記錄，再次 POST
- **THEN** API 回傳 409，拒絕重複提交

#### Scenario: 早於起算日
- **WHEN** 打卡邏輯日 < `effective_start_date`
- **THEN** API 回傳 409

---

### Requirement: 修改當日打卡
`PATCH /api/checkin/submit` SHALL 僅允許修改當日邏輯日（誤觸回溯）。系統 MUST 重算 `base_score` / `total_score` / `punch_streak`，呼叫 `reconcileAchievementsAfterEdit` 進行成就對帳，並寫入 `checkin_edit_logs` 稽核快照。撤銷規則 MUST 採保守策略：只撤 `DAILY_PERFECT` / `DAILY_PERFECT_BONUS` / `PERFECT_10/30`，連續類成就與 `CHECKIN_*` 視為歷史里程碑保留。

#### Scenario: 修改成功
- **WHEN** 成員當日已打卡，提交 PATCH 修改 `tasks`
- **THEN** 系統重算分數、`punch_streak`、對帳成就，回傳 `{ ok, totalScore, baseScore, punchStreak, achievementsAdded, achievementsRemoved }`

#### Scenario: 無既有記錄修改
- **WHEN** 成員當日邏輯日尚無記錄而呼叫 PATCH
- **THEN** API 回傳 404

#### Scenario: 撤銷只影響特定成就
- **WHEN** 成員從 `base_score = 8` 改為 `base_score = 7`
- **THEN** 撤銷 `DAILY_PERFECT`，但保留任何已解鎖的 streak 與 `CHECKIN_*` 成就

#### Scenario: 修改寫入稽核軌跡
- **WHEN** 成員提交 PATCH 修改打卡
- **THEN** `checkin_edit_logs` 新增一筆，記錄 before/after tasks、score、achievements_added、achievements_removed

---

### Requirement: 取得今日打卡狀態
`GET /api/checkin/today` SHALL 回傳 `{ today, calendarDay, sunrise, punchStart, punchStreak, monthRate, todayRecord }`，其中 `today` 為打卡邏輯日、`calendarDay` 為實際日曆日、`punchStart` 為日出 +12 分鐘建議時間。

#### Scenario: 今日已打卡
- **WHEN** 成員當日邏輯日已有記錄，呼叫 GET /today
- **THEN** `todayRecord` 包含當日紀錄；`monthRate` 反映本月即時達成率

#### Scenario: 今日未打卡
- **WHEN** 成員當日邏輯日尚無記錄
- **THEN** `todayRecord` 為 null

---

### Requirement: 連續打拳加分凍結
`punch_bonus` SHALL 固定寫入 0，`total_score = base_score`。連續打拳天數 `punch_streak` SHALL 維持正常累計，作為成就觸發與月結最長連續統計依據。`DAILY_PERFECT_BONUS`（金色大滿貫）成就因依賴 `punch_bonus = 0.5` 而暫停觸發，但成就定義保留於 `constants.ts`。

#### Scenario: 連續打拳天數仍累計
- **WHEN** 成員連續 3 天於 `tasks[1] = true` 打卡
- **THEN** 第 3 天 `punch_streak = 3`

#### Scenario: 加分為 0
- **WHEN** 成員任何天打卡
- **THEN** `punch_bonus = 0`，`total_score = base_score`

---

### Requirement: 工時記錄
打卡 SHALL 接受可選 `work_hours` 數值（任務 5 工作 8 小時的當日實際工時）。`work_hours = NULL` 表示未填寫，月度結算時影響工時補扣計算（見 monthly-settlement capability）。

#### Scenario: 提交工時
- **WHEN** 成員提交 `{ tasks: [...], work_hours: 8.5 }`
- **THEN** `checkin_records.work_hours = 8.5`

#### Scenario: 未提交工時
- **WHEN** 成員提交未含 `work_hours`
- **THEN** `checkin_records.work_hours = NULL`

---

### Requirement: 打卡完成畫面截圖分享
截圖分享功能目前**暫停**：打卡完成卡片 MUST NOT 顯示「截圖分享」按鈕，成員無從觸發截圖。截圖能力的程式（`lib/share-image.ts`、`captureAndShare`、`handleShareScreenshot`）保留於程式碼中備用，僅移除觸發入口；日後恢復僅需加回按鈕。

「修改今日」按鈕不受影響，仍於已完成卡片顯示。

#### Scenario: 產生截圖圖片
- **WHEN** 成員檢視已完成打卡的卡片
- **THEN** 卡片 MUST NOT 出現「截圖分享」觸發入口，無從產生截圖（功能暫停）

#### Scenario: 截圖不含操作按鈕
- **WHEN** 檢視已完成卡片
- **THEN** 因無截圖按鈕，此情境不再適用；「修改今日」按鈕仍顯示

#### Scenario: 截圖能力程式保留
- **WHEN** 檢視程式碼
- **THEN** `lib/share-image.ts` 與相關 handler 保留，僅不再有 UI 觸發點

### Requirement: 優先透過系統分享單分享
產生圖片後，系統 SHALL 優先以 Web Share API（`navigator.share({ files })`）喚起系統分享單，使成員可直接傳送至 LINE 群組或儲存至相簿。

系統 MUST 先以 `navigator.canShare({ files })` 檢查環境是否支援檔案分享，支援時才呼叫 `navigator.share`。使用者於分享單取消 MUST 視為正常操作，MUST NOT 顯示為錯誤。

#### Scenario: 支援檔案分享
- **WHEN** 環境支援 `navigator.canShare({ files })`
- **THEN** 喚起系統分享單，圖片作為分享檔案

#### Scenario: 使用者取消分享
- **WHEN** 使用者於系統分享單按取消（`AbortError`）
- **THEN** 視為正常結束，不顯示錯誤 toast

---

### Requirement: 不支援分享時的退化路徑
當環境不支援檔案分享（部分 LINE 內建瀏覽器 / 舊裝置）時，系統 MUST 提供退化路徑，MUST NOT 讓按鈕點擊後無任何反應。退化行為為：下載該 PNG，或於畫面顯示圖片供使用者長按儲存。系統 MUST 以 toast 告知使用者接下來如何操作。

截圖產生或分享過程若發生非取消類錯誤，系統 MUST 以 toast 告知失敗，MUST NOT 靜默失敗。

#### Scenario: 不支援檔案分享
- **WHEN** `navigator.canShare({ files })` 為否或 `navigator.share` 不存在
- **THEN** 執行退化路徑（下載或顯示圖片供長按儲存），並以 toast 告知操作方式

#### Scenario: 截圖產生失敗
- **WHEN** DOM 轉圖片過程拋出錯誤
- **THEN** 以 toast 顯示失敗訊息，不靜默結束

### Requirement: 破曉打拳前置條件——須同時完成早睡早起
打卡提交時，若 `tasks[1]`（破曉打拳）為 `true`，則 `tasks[0]`（早睡早起／子時入睡）MUST 也為 `true`。系統 SHALL 在 `POST /api/checkin/submit` 與 `PATCH /api/checkin/submit` 兩條路徑皆強制此規則，違反者 MUST 拒絕並回傳 400 與中文錯誤訊息「要打卡「破曉打拳」前，請先完成「早睡早起（子時入睡）」」。

此規則為同一筆打卡內的跨任務約束，MUST NOT 跨日比對前一日紀錄。「早睡早起」只要勾選即視為滿足，無論計分為 1 分（11 點前入睡）或 0.5 分（12 點前入睡，`early_sleep_half = true`）。此規則僅約束提交與修改的合法性，MUST NOT 影響 `calcBaseScore`、`punch_streak` 或成就計算。

#### Scenario: 有打拳但無早睡——拒絕
- **WHEN** 成員提交 `tasks[1] = true` 且 `tasks[0] = false`
- **THEN** API 回傳 400，訊息為「要打卡「破曉打拳」前，請先完成「早睡早起（子時入睡）」」，不寫入任何打卡紀錄

#### Scenario: 早睡與打拳皆勾選——成功
- **WHEN** 成員提交 `tasks[0] = true` 且 `tasks[1] = true`
- **THEN** 打卡正常成立，得分與 `punch_streak` 照常計算

#### Scenario: 早睡採 0.5 分仍視為滿足
- **WHEN** 成員提交 `tasks[0] = true`、`early_sleep_half = true`（12 點前入睡，0.5 分）且 `tasks[1] = true`
- **THEN** 打卡正常成立，不因 0.5 分而被拒

#### Scenario: 只勾早睡、未勾打拳——成功
- **WHEN** 成員提交 `tasks[0] = true` 且 `tasks[1] = false`
- **THEN** 打卡正常成立（規則只在打拳時觸發）

#### Scenario: 早睡與打拳皆未勾——成功
- **WHEN** 成員提交 `tasks[0] = false` 且 `tasks[1] = false`
- **THEN** 打卡正常成立（規則只在打拳時觸發）

#### Scenario: 修改打卡同樣套用前置條件
- **WHEN** 成員以 `PATCH` 將今日打卡改為 `tasks[1] = true` 且 `tasks[0] = false`
- **THEN** API 回傳 400 並拒絕修改，既有紀錄保持不變

### Requirement: 打卡頁請假入口
打卡頁 SHALL 提供「今日請假」入口：學員選事由後送出，即為今日邏輯日請假。請假為選填行為，MUST NOT 影響一般打卡流程；已請假的當日 SHALL 顯示請假狀態（而非未打卡提醒）。

#### Scenario: 打卡頁請今日假
- **WHEN** 學員於打卡頁選事由並送出請假
- **THEN** 今日邏輯日建立請假記錄，頁面顯示已請假狀態

#### Scenario: 請假日不顯示未打卡催促
- **WHEN** 當日已請假
- **THEN** 打卡頁呈現請假狀態，不催促打卡（該日不參與計分）

### Requirement: 首次打卡後顯示本月進度彈窗
首次打卡成功（`POST /api/checkin/submit` 回傳 `ok: true`）後，打卡頁 SHALL 顯示一個「本月進度」彈窗，內容與 `/dashboard` 頁月度進度卡一致：累計得分、達成率、距目標差、剩餘天數提醒，以及當月每日達成率折線圖（含本月／上月／歷史累積平均三線比較，若無上月或歷史資料則對應折線省略）。彈窗資料 SHALL 透過既有 `GET /api/stats/dashboard`（當月、不帶 `month` 參數）取得，MUST NOT 新增後端 API 或改變 `POST /api/checkin/submit` 的回應格式。

彈窗 SHALL 提供明確關閉方式（關閉按鈕或點擊背景），MUST NOT 強制使用者互動或阻擋後續操作。

#### Scenario: 首次打卡成功顯示進度彈窗
- **WHEN** 成員當日邏輯日尚無記錄，提交 `tasks` 且 API 回傳成功
- **THEN** 打卡頁在既有的「今日已打卡」確認畫面之外，額外顯示本月進度彈窗（累計得分/達成率/距目標差 + 三線折線圖）

#### Scenario: 無上月或歷史資料時的降級顯示
- **WHEN** 成員本月為首個計分月（無上月資料），或僅有本月一個月的歷史紀錄
- **THEN** 進度彈窗仍正常顯示本月折線與數字，上月折線/歷史累積平均折線依既有圖表規則省略，不顯示錯誤

### Requirement: 修改打卡不觸發進度彈窗
`PATCH /api/checkin/submit`（修改當日打卡，誤觸回溯）成功後，MUST NOT 顯示本月進度彈窗。此行為僅限首次提交（POST）。

#### Scenario: 修改今日打卡
- **WHEN** 成員使用「修改今日」流程送出 `PATCH /api/checkin/submit` 且成功
- **THEN** 僅顯示既有的修改成功提示（toast），不彈出本月進度彈窗

### Requirement: 與成就彈窗的顯示順序
若同一次首次打卡同時解鎖一個或多個成就，系統 SHALL 先顯示成就彈窗（依既有佇列邏輯逐一顯示），待使用者關閉最後一個成就彈窗後，才顯示本月進度彈窗。兩者 MUST NOT 同時顯示或互相覆蓋。若該次打卡未解鎖任何成就，本月進度彈窗 SHALL 直接顯示（不等待一個空的成就流程）。

#### Scenario: 打卡同時解鎖成就
- **WHEN** 成員首次打卡成功，且該次提交解鎖 2 個成就
- **THEN** 先依序顯示 2 個成就彈窗，使用者關閉最後一個後，接著顯示本月進度彈窗

#### Scenario: 打卡未解鎖任何成就
- **WHEN** 成員首次打卡成功，該次提交未解鎖新成就
- **THEN** 直接顯示本月進度彈窗，不經過成就彈窗流程

## Data Model

### checkin_records

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| member_id | TEXT FK | UNIQUE with date |
| date | DATE | 打卡邏輯日 |
| tasks | BOOLEAN[8] | 8 任務狀態 |
| base_score | INT | 0–8 |
| punch_bonus | NUMERIC | 固定 0（加分暫停） |
| total_score | NUMERIC | = base_score |
| punch_streak | INT | 當日截止連續打拳天數 |
| note | TEXT | 選填 |
| work_hours | NUMERIC | 實際工時，NULL = 未填 |
| submit_time | TIMESTAMPTZ | |

### checkin_edit_logs

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| member_id | TEXT FK | |
| date | DATE | 被編輯的打卡邏輯日 |
| before_tasks / after_tasks | BOOLEAN[] | 編輯前後 8 任務狀態 |
| before_score / after_score | NUMERIC | 編輯前後 total_score |
| achievements_added | TEXT[] | 編輯後新解鎖 |
| achievements_removed | TEXT[] | 編輯後撤銷 |
| edited_at | TIMESTAMPTZ | |

## Business Logic

`calcBaseScore(tasks: boolean[8]) → number`：回傳完成任務數（0–8）。純函式，定義於 `lib/scoring.ts`。

## Rate Limiting

`POST /api/checkin/submit` per-IP 限流 20 次/分鐘。

## Notes

- 不設獨立補報機制；遺漏的歷史日期無法後補打卡
- 日出時間透過 `lib/sunrise.ts` 取得（24h DB 快取，跨 Vercel instance 共用）
