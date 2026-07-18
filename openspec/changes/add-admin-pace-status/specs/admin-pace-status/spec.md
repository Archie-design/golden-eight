## ADDED Requirements

### Requirement: Pace（回顧軸）計算
系統 SHALL 為本月每位計分成員計算 pace，定義為 `pace = 總分 ÷ (到今日應打天數 × 8 × 該階級門檻)`，以百分比表示。「到今日應打天數」以 `expectedCheckinDays`（成員 effective_start_date 或月初起算，至今日）為準；門檻依成員階級（黃金 0.80 / 白銀 0.70 / 青銅 0.60）。pace ≥ 85% 視為「跟得上」，< 85% 視為「跟不上」。

#### Scenario: 跟得上達標軌跡
- **WHEN** 成員總分達「到今日達標線」的 85% 以上
- **THEN** pace 判定為「跟得上」

#### Scenario: 落後達標軌跡
- **WHEN** 成員總分不足「到今日達標線」的 85%
- **THEN** pace 判定為「跟不上」

---

### Requirement: 月底預估（前瞻軸）計算
系統 SHALL 為本月每位計分成員計算月底預估完成率，定義為 `projRate = (總分 ÷ 已過天數 × 當月總天數) ÷ 月滿分`（線性外推），以百分比表示。projRate ≥ 該階級門檻視為「月底能過關」，< 門檻視為「月底會被罰」。

#### Scenario: 月底預估能過關
- **WHEN** 依當前速度線性外推，月底預估完成率達該階級門檻
- **THEN** 前瞻軸判定為「能過關」

#### Scenario: 月底預估會被罰
- **WHEN** 線性外推的月底完成率低於該階級門檻
- **THEN** 前瞻軸判定為「會被罰」

---

### Requirement: 二維綜合狀態
系統 SHALL 以 pace（回顧軸）與月底預估（前瞻軸）兩軸綜合出四象限狀態，取代狀態欄原本的二元「達標/未達標」：

- 🔴 **真的要救**：pace < 85% 且 月底預估 < 門檻
- 🟠 **溫水（易忽略）**：pace ≥ 85% 但 月底預估 < 門檻
- 🟡 **起步慢（追趕中）**：pace < 85% 但 月底預估 ≥ 門檻
- ✅ **安全**：pace ≥ 85% 且 月底預估 ≥ 門檻

狀態欄 MUST 以此四象限為主視覺；月率、pace%、月底預估% MAY 作為輔助數字呈現。

#### Scenario: 過去落後且月底撞不到門檻
- **WHEN** 成員 pace < 85% 且月底預估 < 門檻
- **THEN** 狀態顯示「🔴 真的要救」

#### Scenario: 看似跟上但月底會被罰
- **WHEN** 成員 pace ≥ 85% 但月底預估 < 門檻
- **THEN** 狀態顯示「🟠 溫水」

#### Scenario: 起步慢但正在追回
- **WHEN** 成員 pace < 85% 但月底預估 ≥ 門檻
- **THEN** 狀態顯示「🟡 起步慢」

#### Scenario: 過去好且月底也穩
- **WHEN** 成員 pace ≥ 85% 且月底預估 ≥ 門檻
- **THEN** 狀態顯示「✅ 安全」

---

### Requirement: 豁免成員不分級
本月不參與計分的成員（`calcMonthStats` 回 `maxScore = 0`，即 effective_start_date 使其本月豁免）MUST NOT 計算 pace 或月底預估，狀態欄 MUST 顯示「本月新進」而非任何象限或百分比。

#### Scenario: 本月新進成員
- **WHEN** 成員本月豁免（maxScore = 0）
- **THEN** 狀態顯示「本月新進」，不顯示 pace、月底預估或象限

---

### Requirement: 僅本月現時視圖套用二維狀態
二維綜合狀態 MUST 僅在本月現時視圖（`isCurrentMonth = true`）計算與顯示。歷史已月結月份（`isCurrentMonth = false`）MUST 維持既有月結結果（`settledPassing`）的達標/未達標顯示，MUST NOT 計算 pace 或月底預估（月已結束，兩者無意義）。

#### Scenario: 檢視本月
- **WHEN** 管理員檢視當前月份的全員進度
- **THEN** 狀態欄顯示二維四象限

#### Scenario: 檢視歷史月份
- **WHEN** 管理員檢視已月結的歷史月份
- **THEN** 狀態欄維持月結達標/未達標，不顯示象限或 pace
