# Achievement System Capability

## Purpose

提供成就解鎖、進度追蹤與成就稀有度統計。系統內建 45 項基礎成就（任務連續類 32 + 單日特殊類 3 + 月度類 5 + 累積里程碑 5），由打卡提交、打卡修改、月結三個事件觸發。`lib/constants.ts` 為單一真相來源；解鎖記錄寫入 `achievements` 表（UNIQUE(member_id, code)）。

## Requirements

### Requirement: 成就清單為單一真相來源
所有成就定義 MUST 集中於 `lib/constants.ts` 的 `ACHIEVEMENT_LIST` 陣列。每項成就 MUST 至少包含 `code`、`name`、`badge`（圖示）、`type` 欄位。前端徽章渲染、後端觸發邏輯均以此清單為基準。

#### Scenario: 新增成就
- **WHEN** 開發者新增一項成就
- **THEN** 僅需在 `ACHIEVEMENT_LIST` 加入新項，前端徽章牆與後端解鎖邏輯自動識別

---

### Requirement: 任務連續類成就（32 項）
8 項每日任務各 SHALL 對應 4 個連續打卡里程碑（3/7/30/100 天），代碼格式 `T{n}_STREAK_{days}`。連續判斷 MUST 使用「打卡邏輯日」連續性（`calcTaskStreak`），最大窗口 105 日足以覆蓋 100 天里程碑。

| 任務 | 3 天 | 7 天 | 30 天 | 100 天 |
|------|------|------|-------|--------|
| T1 早睡早起 | 早鳥初心 | 早鳥習慣 | 早鳥達人 | 早鳥百日 |
| T2 破曉打拳 | 破曉初煉 | 破曉星火 | 破曉月將 | 破曉百日俠 |
| T3 丹氣跑步 | 跑步初動 | 跑步習慣 | 跑步達人 | 百日跑者 |
| T4 曬太陽 | 初曬太陽 | 陽光習慣 | 陽光達人 | 百日暖陽 |
| T5 工作 8 小時 | 勤奮初心 | 勤奮習慣 | 職人達人 | 職人百日 |
| T6 不吃肉 | 素心初願 | 素心習慣 | 素食達人 | 素食百日 |
| T7 寫觀心書 | 觀心初啟 | 觀心習慣 | 觀心達人 | 觀心百日 |
| T8 淨心功法 | 淨心初動 | 淨心習慣 | 淨心達人 | 淨心百日 |

#### Scenario: 連續 3 天解鎖青銅
- **WHEN** 成員連續 3 個邏輯日 `tasks[1] = true`
- **THEN** 解鎖 `T2_STREAK_3`（破曉初煉）

#### Scenario: 中斷後重新計算
- **WHEN** 成員 `tasks[1]` 連續 5 天後第 6 天 `false`，第 7 天再 `true`
- **THEN** 連續從第 7 天起重新累計

---

### Requirement: 單日特殊類成就（3 項）
系統 SHALL 提供 3 項單日特殊成就，於打卡提交時觸發判定：

| 代碼 | 名稱 | 觸發條件 |
|------|------|---------|
| FIRST_CHECKIN | 萬里起行 | 第一次打卡 |
| DAILY_PERFECT | 大滿貫 | 單日 `base_score = 8` |
| DAILY_PERFECT_BONUS | 金色大滿貫 | `total_score ≥ 8.5`（暫停觸發） |

`DAILY_PERFECT_BONUS` SHALL 因 `punch_bonus` 凍結（固定 0）而暫停觸發。成就定義保留於 `constants.ts`，待加分功能重啟後自動解封；不回填、不刪除。

#### Scenario: 首次打卡
- **WHEN** 成員生平第一筆 `checkin_records` 寫入
- **THEN** 解鎖 `FIRST_CHECKIN`

#### Scenario: 單日全部完成
- **WHEN** 成員單日 8 個 `tasks` 全為 `true`
- **THEN** 解鎖 `DAILY_PERFECT`

#### Scenario: 金色大滿貫凍結
- **WHEN** 任何打卡提交
- **THEN** `DAILY_PERFECT_BONUS` 不觸發（`total_score` 永不 ≥ 8.5，因 `punch_bonus = 0`）

---

### Requirement: 月度類成就（5 項）
月度成就 SHALL 在月結時透過 `calcMonthlyAchievements` 觸發。

| 代碼 | 名稱 | 條件 |
|------|------|------|
| MONTH_PASS | 初次通關 | 首次月結通過 |
| MONTH_GOLD | 黃金通關 | 以黃金戰士通過月結 |
| MONTH_PERFECT | 完美月 | 月達成率 ≥ 100% |
| MONTH_STREAK_3 | 三月連勝 | 累計通關月份數 ≥ 3 |
| MONTH_STREAK_6 | 半年英雄 | 累計通關月份數 ≥ 6 |

`passingCount` MUST 由 settlement route 從 `monthly_summary` 統計傳入（v1.3 修正：不可從 `achievements` 表反推）。

#### Scenario: 首次通關
- **WHEN** 成員第一次月結 `passing = true`
- **THEN** 解鎖 `MONTH_PASS`

#### Scenario: 完美月
- **WHEN** 月達成率 = 100%
- **THEN** 解鎖 `MONTH_PERFECT`

#### Scenario: 累計三次通關
- **WHEN** 成員第 3 次月結通過
- **THEN** 解鎖 `MONTH_STREAK_3`（含本次月結的 `monthly_summary` 通過記錄計數）

---

### Requirement: 累積里程碑成就（5 項）
系統 SHALL 提供 5 項累積里程碑成就，於打卡提交時依累計次數觸發：

| 代碼 | 名稱 | 條件 |
|------|------|------|
| CHECKIN_30 | 打卡 30 天 | 累計打卡 ≥ 30 天 |
| CHECKIN_100 | 打卡百日 | 累計打卡 ≥ 100 天 |
| CHECKIN_365 | 打卡一年 | 累計打卡 ≥ 365 天 |
| PERFECT_10 | 大滿貫 x10 | 累計大滿貫 ≥ 10 次 |
| PERFECT_30 | 大滿貫 x30 | 累計大滿貫 ≥ 30 次 |

#### Scenario: 累計打卡 30 天
- **WHEN** 成員 `COUNT(checkin_records) = 30`
- **THEN** 解鎖 `CHECKIN_30`

#### Scenario: 累計大滿貫 10 次
- **WHEN** 成員累計 `base_score = 8` 達 10 天
- **THEN** 解鎖 `PERFECT_10`

---

### Requirement: 提交時的高效成就計算
打卡 POST 時 `calcNewAchievementsFromAggregates` MUST 使用聚合 counter + 105 日滑動窗口計算，避免全量歷史掃描。終端成就（`CHECKIN_365` / `PERFECT_30`）若已解鎖，COUNT 查詢 SHALL 跳過（傳入 `Number.MAX_SAFE_INTEGER`）。

#### Scenario: 打卡時計算成就
- **WHEN** 成員提交打卡
- **THEN** 系統以聚合 counter 與最近 105 日記錄計算新解鎖成就，回傳 `newAchievements[]`

#### Scenario: 終端成就跳過 COUNT
- **WHEN** 成員已解鎖 `CHECKIN_365`，再次打卡
- **THEN** 不再執行累計打卡 COUNT 查詢

---

### Requirement: 修改打卡時的成就對帳
打卡 PATCH 時 `reconcileAchievementsAfterEdit` MUST 重新查詢全量計數（COUNT 可能下降），並依保守規則處理：

- 新增：所有確定達成者
- 撤銷（保守規則）：只撤 `DAILY_PERFECT` / `DAILY_PERFECT_BONUS` / `PERFECT_10` / `PERFECT_30`
- 保留：streak 與 `CHECKIN_*` 視為歷史里程碑保留

#### Scenario: 修改後 base_score 從 8 改為 7
- **WHEN** 成員修改當日 `tasks` 使 `base_score` 由 8 變 7
- **THEN** 撤銷 `DAILY_PERFECT`，保留所有 streak 成就與 `CHECKIN_*`

#### Scenario: 修改後新解鎖
- **WHEN** 成員修改當日 `tasks` 使 `base_score` 由 6 變 8
- **THEN** 解鎖 `DAILY_PERFECT`（若尚未解鎖）

---

### Requirement: 解鎖記錄唯一性
`achievements` 表 MUST 設 UNIQUE(member_id, code)，確保每位成員每項成就至多解鎖一次。觸發邏輯遇到既有解鎖時 SHALL 跳過寫入。

#### Scenario: 重複觸發
- **WHEN** 已解鎖 `DAILY_PERFECT` 的成員再達成大滿貫
- **THEN** UNIQUE 約束保護，不重複寫入

---

### Requirement: 破曉王不佔成就表
破曉王 SHALL 以 `monthly_summary.is_dawn_king` 旗標記錄，不寫入 `achievements` 表，避免與「未來累計三次破曉王成就」衝突。

#### Scenario: 破曉王月份
- **WHEN** 月結判定成員為破曉王
- **THEN** `monthly_summary.is_dawn_king = true`、`achievements` 表不新增列

---

## Data Model

### achievements

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| member_id | TEXT FK | UNIQUE with code |
| code | TEXT | 成就代碼，對應 `ACHIEVEMENT_LIST.code` |
| unlocked_at | TIMESTAMPTZ | |

## Business Logic

定義於 `lib/scoring.ts`：

- `calcNewAchievementsFromAggregates({ totalCount, perfectCount, recentSorted, todayRecord, alreadyUnlocked })` → 觸發清單（聚合 + 105 日窗口）
- `reconcileAchievementsAfterEdit({ ... })` → `{ add, remove[] }`（保守撤銷規則）
- `calcMonthlyAchievements(passing, rate, level, alreadyUnlocked, passingCount)` → 月度成就觸發

## Notes / Limitations

- `MONTH_STREAK_3 / MONTH_STREAK_6` v1.3 修正前未觸發過：應獲獎成員需執行 `POST /api/admin/backfill-achievements`
- `DAILY_PERFECT_BONUS` 暫停觸發，待加分機制重啟
- 未來擴充候選：`CHECKIN_200`、`CHECKIN_500`、`MONTH_FULL_CHECKIN`、`DAWN_KING`
