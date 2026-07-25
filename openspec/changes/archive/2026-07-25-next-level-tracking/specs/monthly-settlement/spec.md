## ADDED Requirements

### Requirement: 下月階梯選擇快照
月結 SHALL 在 `monthly_summary` 寫入 `chose_next_level BOOLEAN` 欄位，記錄該成員「月結套用 next_level 之前」是否已選下月階梯（`members.next_level IS NOT NULL`）。此快照 MUST 為唯一資料來源——不可從 `members.next_level` 在月結後反推（已被清空）。

#### Scenario: 已選下月階梯
- **WHEN** 月結執行時成員 `members.next_level = '黃金戰士'`
- **THEN** `monthly_summary.chose_next_level = true`，next_level 套用至 level 後清空

#### Scenario: 未選下月階梯
- **WHEN** 月結執行時成員 `members.next_level IS NULL`
- **THEN** `monthly_summary.chose_next_level = false`

#### Scenario: 快照語意
- **WHEN** 7/1 月結針對 `year_month = '2026-06'` 寫入時
- **THEN** `chose_next_level` 表示「成員是否選了 7 月（即下個月）階梯」

---

## MODIFIED Requirements

### Requirement: 新進成員不參與計分
若 `effective_start_date > monthEnd`（或當月 > today），`calcMonthStats` MUST 回傳 `maxScore = 0`。`runSettlement` MUST 為新進豁免成員寫入 `monthly_summary` stub 列：`max_score = 0`、`total_score = 0`、`rate = 0`、`passing = false`、`penalty = 0`、`max_streak = 0`、`is_dawn_king = false`、`work_hours_deduction = 0`、`chose_next_level = (members.next_level IS NOT NULL)`。stub 列僅用於追蹤 `chose_next_level` 與保留歷史證據，不影響罰款計算。前端 SHALL 在 `max_score = 0` 時顯示「本月新進，不參與計分」而非 `0%`，API 回應 SHALL 設 `exempted: true`。

#### Scenario: 新進成員寫入 stub 列
- **WHEN** 成員 5/29 加入（`effective_start_date = 5/30`），管理員執行 5 月結算
- **THEN** `monthly_summary` 新增該成員列，`max_score = 0`、`chose_next_level` 反映 next_level snapshot

#### Scenario: 新進成員的 chose_next_level 也被快照
- **WHEN** 5/30 加入的成員在 5/31 23:59 設定 `next_level = '黃金戰士'`，6/1 月結執行
- **THEN** stub 列 `chose_next_level = true`

#### Scenario: UI 顯示豁免狀態
- **WHEN** 排行榜或儀表板載入新進成員的當月狀態
- **THEN** 顯示「本月新進，不參與計分」，不顯示 0% 達成率

---

### Requirement: 月結套用 next_level
月結時系統 MUST 將所有 `status != '停用'` 成員的 `members.next_level`（成員於 25 日後選擇的下月階梯）套用至 `members.level`，並清空 `next_level` 欄位。此動作 MUST 涵蓋新進豁免成員（避免其 next_level 跨月停滯）。`next_level IS NULL` 的成員 SHALL 維持原 level 不變。

#### Scenario: 套用下月階梯
- **WHEN** 成員 `next_level = '黃金戰士'`，月結執行
- **THEN** `level = '黃金戰士'`、`next_level = NULL`

#### Scenario: 未設下月階梯保持不變
- **WHEN** 成員 `next_level IS NULL`
- **THEN** `level` 維持月結前值，`next_level` 維持 NULL

#### Scenario: 新進豁免成員也被套用
- **WHEN** 新進豁免成員 `next_level = '黃金戰士'`，月結執行
- **THEN** 該成員 `level = '黃金戰士'`、`next_level = NULL`，stub 列 `chose_next_level = true`

#### Scenario: 已停用成員不處理
- **WHEN** 成員 `status = '停用'`
- **THEN** `runSettlement` 不寫入 `monthly_summary`、不更動 `level` / `next_level`
