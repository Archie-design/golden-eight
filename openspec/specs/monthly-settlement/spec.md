# Monthly Settlement Capability

## Purpose

每月將每位成員的打卡記錄結算為達成率、工時補扣、是否通關、未達標罰款金額。月結同時套用成員當月選擇的下月階梯、選出破曉王、並觸發月度類成就。本 capability 包含結算公式、戰士階梯/罰款規則、新進成員不參與計分機制、以及由 cron 與管理員 API 兩個入口呼叫的共用 `runSettlement` 邏輯。

## Requirements

### Requirement: 戰士階梯與達成率門檻
系統 SHALL 提供三個戰士階梯，各對應達成率門檻與未達標罰款金額：

| 階梯 | 達成率門檻 | 未達罰款 |
|------|-----------|---------|
| 黃金戰士 | ≥ 80% | NT$200 |
| 白銀戰士 | ≥ 70% | NT$300 |
| 青銅戰士 | ≥ 60% | NT$400 |

通關判定（`passing`）為當月達成率 ≥ 階梯門檻；未通關則套用對應罰款。

#### Scenario: 黃金戰士達成率 85% 通關
- **WHEN** 黃金戰士月達成率 = 85%
- **THEN** `passing = true`、`penalty = 0`

#### Scenario: 白銀戰士達成率 65% 未通關
- **WHEN** 白銀戰士月達成率 = 65%
- **THEN** `passing = false`、`penalty = 300`

---

### Requirement: 月度結算公式
`calcMonthStats(member, records, refDate)` SHALL 計算月度結算各項數值，公式如下：

```
有效起始日 = max(月份第一天, effective_start_date)
有效天數   = refDate - 有效起始日 + 1（含端點）
有效滿分   = 有效天數 × 8
工時補扣   = ceil(max(0, 工作日×8 − 月累計工時) / 8) 分
調整後總分 = Σ total_score − 工時補扣
達成率     = round(調整後總分 ÷ 有效滿分 × 100)
```

`refDate` SHALL 為「歷史月份取月底、當月取今日」（`min(today, monthEnd)`），確保歷史月份分母完整、當月分母即時。

#### Scenario: 當月即時達成率
- **WHEN** 5/15 計算 5 月達成率
- **THEN** `refDate = 5/15`、有效天數最多 15 天

#### Scenario: 歷史月份完整達成率
- **WHEN** 5 月任意時間查 4 月達成率
- **THEN** `refDate = 4/30`、分母 = 4 月有效天數 × 8

---

### Requirement: 工時補扣
工時補扣分數 SHALL 由 `calcWorkHoursDeduction(totalWorkHours, workingDays)` 計算：每少 8 小時扣 1 分（`ceil(max(0, workingDays * 8 − totalWorkHours) / 8)`）。`monthly_summary.work_hours_deduction` 記錄此分數，並從調整後總分中扣除。

#### Scenario: 工時齊全
- **WHEN** 工作日 22 天 × 8 小時 = 176 小時，月累計實際 180 小時
- **THEN** `work_hours_deduction = 0`

#### Scenario: 工時不足扣分
- **WHEN** 工作日 22 天 × 8 = 176 小時，月累計實際 160 小時（差 16）
- **THEN** `work_hours_deduction = ceil(16/8) = 2` 分

---

### Requirement: 新進成員不參與計分
若 `effective_start_date > monthEnd`（或當月 > today），`calcMonthStats` MUST 回傳 `maxScore = 0`。`runSettlement` MUST 跳過這類成員：不寫 `monthly_summary`、不計罰款、不更新 `level`、不觸發月度成就。前端 SHALL 顯示「本月新進，不參與計分」而非 `0%`。

#### Scenario: 新進成員當月不結算
- **WHEN** 成員 5/28 加入（`effective_start_date = 5/29`），管理員執行 5 月結算
- **THEN** `monthly_summary` 不新增該成員的紀錄，API 回應該成員 `exempted = true`

#### Scenario: UI 顯示豁免狀態
- **WHEN** 排行榜或儀表板載入新進成員的當月狀態
- **THEN** 顯示「本月新進，不參與計分」字樣，不顯示 0% 達成率

---

### Requirement: 破曉王選出
破曉王 SHALL 由 `isDawnKing(member, records, ym, refDate)` 判定，條件為：
1. `expectedCheckinDays > 0`（不是新進當月）
2. `records.length === expectedDays`（沒有缺打卡）
3. 每筆 `tasks[1] = true`（每日都有打拳）

`refDate = min(today, monthEnd)`，使歷史月份以月底為基準、當月以今日為基準。月結時將結果寫入 `monthly_summary.is_dawn_king`。

#### Scenario: 完整月每日打拳
- **WHEN** 4/29 加入的成員 5 月每日打卡且 `tasks[1] = true`
- **THEN** `is_dawn_king = true`

#### Scenario: 缺一天打拳
- **WHEN** 5 月 31 天中有 1 天 `tasks[1] = false`
- **THEN** `is_dawn_king = false`

#### Scenario: 缺一天打卡
- **WHEN** 5 月 31 天中有 1 天無 `checkin_records` 記錄
- **THEN** `is_dawn_king = false`

---

### Requirement: 月結套用 next_level
月結時系統 MUST 將 `members.next_level`（成員於 25 日後選擇的下月階梯）套用至 `members.level`，並清空 `next_level` 欄位。此動作在 `monthly_summary` 寫入後同 transaction 進行。

#### Scenario: 套用下月階梯
- **WHEN** 成員 `next_level = '黃金戰士'`，月結執行
- **THEN** `level = '黃金戰士'`、`next_level = NULL`

#### Scenario: 未設下月階梯保持不變
- **WHEN** 成員 `next_level IS NULL`
- **THEN** `level` 維持月結前值

---

### Requirement: runSettlement 共用入口與冪等性
`runSettlement(db, yearMonth, today)` SHALL 為月結邏輯的單一入口，由管理員 `POST /api/admin/settlement` 與 cron `GET /api/cron/monthly-settlement` 共用呼叫。寫入 `monthly_summary` MUST 採 upsert（UNIQUE(member_id, year_month)），確保多次執行為冪等操作。

#### Scenario: 重複執行月結
- **WHEN** 同一 `yearMonth` 的月結 cron 與管理員手動觸發各執行一次
- **THEN** `monthly_summary` 對每位成員只有一筆記錄（upsert 結果一致）

#### Scenario: 月結後再執行
- **WHEN** 月結完成後再次以相同 `yearMonth` 呼叫 `runSettlement`
- **THEN** 結算數值依當前資料重新計算並 upsert，不出現重複列

---

### Requirement: 月結 Cron 排程
Vercel cron `/api/cron/monthly-settlement` SHALL 於 UTC 05:00（台北 13:00）每月 1 號執行，結算上個月份。Cron 排程 MUST 在台北 12:00 之後（打卡日邊界）以確保前一月最後一天的有效打卡完整收齊。Cron 路由 MUST 驗證 `Authorization: Bearer CRON_SECRET`。

#### Scenario: Cron 結算前一月
- **WHEN** 5/1 13:00 cron 觸發
- **THEN** `runSettlement(db, '2026-04', today='2026-05-01')` 執行，4/30 24 小時內所有打卡（含 5/1 0:00–12:00 的「邏輯日 4/30」打卡）已完整

#### Scenario: 缺少 CRON_SECRET
- **WHEN** 請求無 `Authorization: Bearer CRON_SECRET`
- **THEN** API 回傳 401

---

### Requirement: 月度類成就
月結 SHALL 透過 `calcMonthlyAchievements(passing, rate, level, alreadyUnlocked, passingCount)` 觸發 5 項月度成就。`passingCount` MUST 由 settlement route 從 `monthly_summary` 統計傳入（不能從 `achievements` 反推）。

| 代碼 | 條件 |
|------|------|
| MONTH_PASS | 首次月結通過 |
| MONTH_GOLD | 以黃金戰士通過月結 |
| MONTH_PERFECT | 月達成率 ≥ 100% |
| MONTH_STREAK_3 | 累計通關月份數 ≥ 3 |
| MONTH_STREAK_6 | 累計通關月份數 ≥ 6 |

#### Scenario: 第 3 次通關解鎖三月連勝
- **WHEN** 成員第 3 次月結通過
- **THEN** 解鎖 `MONTH_STREAK_3`（v1.3 修正前 bug：原以 `MONTH_PASS` UNIQUE 計數恆 ≤ 1 永不觸發）

#### Scenario: 黃金戰士通關
- **WHEN** 黃金戰士月結通過
- **THEN** 解鎖 `MONTH_PASS`（若首次）+ `MONTH_GOLD`

---

## Data Model

### monthly_summary

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| member_id | TEXT FK | UNIQUE with year_month |
| year_month | TEXT | YYYY-MM |
| total_score | NUMERIC | 含工時補扣後的調整分 |
| max_score | NUMERIC | 有效天數 × 8 |
| rate | NUMERIC | 0–100% |
| passing | BOOLEAN | |
| penalty | INT | NT$0 / 200 / 300 / 400 |
| max_streak | INT | 當月最長連續打拳 |
| is_dawn_king | BOOLEAN | |
| work_hours_deduction | INT | |
| settled_at | TIMESTAMPTZ | |

## Business Logic

定義於 `lib/scoring.ts`、`lib/settlement.ts`：

- `calcMonthStats(member, records, refDate)` → `{ maxScore, totalScore, rate, targetScore, remaining, passing }`
- `calcPenalty(level, passing)` → `0 | 200 | 300 | 400`
- `calcWorkHoursDeduction(totalWorkHours, workingDays)` → 補扣分數
- `isDawnKing(member, records, ym, refDate)` → boolean
- `calcMonthlyAchievements(passing, rate, level, alreadyUnlocked, passingCount)` → 觸發成就清單
- `runSettlement(db, yearMonth, today)` → 月結主入口

## Notes / Limitations

- v1.3 修正 `MONTH_STREAK_3 / MONTH_STREAK_6` 歷史 bug：若有應獲獎但未發放成員，需執行 `POST /api/admin/backfill-achievements` 回填
- Cron schedule: `0 5 1 * *`（UTC 05:00 = 台北 13:00 月初一日）
