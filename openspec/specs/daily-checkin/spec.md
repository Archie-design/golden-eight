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
