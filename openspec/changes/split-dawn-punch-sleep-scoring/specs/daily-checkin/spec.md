# Spec Delta

## REMOVED Requirements

### Requirement: 破曉打拳前置條件——須同時完成早睡早起
**Reason**: 兩項任務改為真正獨立計分，互不影響；打拳不再要求同日早睡早起已完成。
**Migration**: 既有呼叫端（`POST`/`PATCH /api/checkin/submit`）移除此 refine 規則；歷史已通過驗證的紀錄不受影響。

## MODIFIED Requirements

### Requirement: 八項每日任務定義
系統 SHALL 提供 8 項固定任務，每項 1 分，最高 8 分／天：
| # | 任務 | 說明 |
|---|------|------|
| 1 | 早睡早起 | 入睡時間 11 點前、且睡眠時數滿 6 小時，兩條件同時滿足才算達成 |
| 2 | 破曉打拳 | 日出後建議開始時間（有連續天數統計）；與「早睡早起」互不影響，各自獨立計分 |
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

#### Scenario: 早睡早起雙條件皆滿足
- **WHEN** 成員勾選「早睡早起」，填入睡時間 22:30、起床時間 05:00（睡眠時數 6.5 小時，入睡在 23:00 前）
- **THEN** 系統判定該任務達成，計 1 分

#### Scenario: 入睡時間達標但睡眠時數不足
- **WHEN** 成員勾選「早睡早起」，填入睡時間 22:50、起床時間 03:30（睡眠時數 4.67 小時，入睡在 23:00 前但未滿 6 小時）
- **THEN** 系統判定該任務未達成，計 0 分

#### Scenario: 睡眠時數足夠但入睡時間超過 11 點
- **WHEN** 成員勾選「早睡早起」，填入睡時間 23:30、起床時間 06:00（睡眠時數 6.5 小時，但入睡晚於 23:00）
- **THEN** 系統判定該任務未達成，計 0 分

#### Scenario: 破曉打拳不受早睡早起狀態影響
- **WHEN** 成員當日「早睡早起」未達成或未勾選，但完成「破曉打拳」
- **THEN** 系統允許提交，「破曉打拳」獨立計 1 分，不受「早睡早起」結果影響

### Requirement: 提交打卡
`POST /api/checkin/submit` SHALL 接受 `{ tasks: boolean[8], note?, work_hours?, sleep_start?, sleep_end? }`，其中 `sleep_start`/`sleep_end` 為勾選「早睡早起」（`tasks[0]`）時的入睡/起床時間。系統計算 `base_score = calcBaseScore(tasks, sleep_start, sleep_end)`，`punch_bonus` 固定為 0，`total_score = base_score`。系統 MUST 同時更新 `punch_streak`（當日截止連續打拳天數）。已有當日邏輯日記錄者 MUST 拒絕重複提交。

#### Scenario: 首次提交當日打卡
- **WHEN** 成員當日邏輯日尚無記錄，提交 `tasks`
- **THEN** `checkin_records` 寫入新列，回傳 `{ ok, totalScore, baseScore, punchStreak, newAchievements[] }`

#### Scenario: 重複提交
- **WHEN** 成員當日邏輯日已有記錄，再次 POST
- **THEN** API 回傳 409，拒絕重複提交

#### Scenario: 早於起算日
- **WHEN** 打卡邏輯日 < `effective_start_date`
- **THEN** API 回傳 409

#### Scenario: 勾選早睡早起但缺少時間欄位
- **WHEN** 成員提交打卡，`tasks[0] = true` 但未提供 `sleep_start` 或 `sleep_end`
- **THEN** 系統 MUST 拒絕並回傳 400 與提示需填入睡/起床時間

### Requirement: 修改當日打卡
`PATCH /api/checkin/submit` SHALL 僅允許修改當日邏輯日（誤觸回溯），輸入格式與 `POST` 一致（含 `sleep_start`/`sleep_end`）。系統 MUST 重算 `base_score` / `total_score` / `punch_streak`，呼叫 `reconcileAchievementsAfterEdit` 進行成就對帳，並寫入 `checkin_edit_logs` 稽核快照。撤銷規則 MUST 採保守策略：只撤 `DAILY_PERFECT` / `DAILY_PERFECT_BONUS` / `PERFECT_10/30`，連續類成就與 `CHECKIN_*` 視為歷史里程碑保留。

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

#### Scenario: 修改打卡調整睡眠時間改變早睡早起判定
- **WHEN** 成員修改當日打卡，將 `sleep_end` 從 05:00 改為 07:30（睡眠時數因此低於 6 小時）
- **THEN** 系統重算 `base_score`，「早睡早起」該日分數由 1 分降為 0 分，並依保守撤銷規則處理相關成就
