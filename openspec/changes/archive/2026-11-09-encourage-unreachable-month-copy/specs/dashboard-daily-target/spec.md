# Spec Delta

## MODIFIED Requirements

### Requirement: 日均提醒的三情境呈現
系統 SHALL 於學員儀表板「距目標差」附近以一句話呈現日均提醒，依情境分三種：

- **已達標**（`remaining ≤ 0`）：呈現「已達標，繼續保持」語意，MUST NOT 顯示日均需分。
- **一般**（日均需分 ≤ 8）：呈現「還有 N 天，平均每天需 X 分達標」。
- **已難達標**（日均需分 > 8，超過單日上限 8 分）：呈現鼓勵持續、不誤導可追回的語意（「為自己的心而做，能量會累積，不要放棄」），MUST NOT 誤導學員以為可追回，MUST NOT 呈現「放棄」「沒救了」等促使學員停止打卡的語意。

#### Scenario: 已達標
- **WHEN** `remaining ≤ 0`
- **THEN** 顯示「✅ 已達標，繼續保持！」，不顯示日均需分

#### Scenario: 尚可達成
- **WHEN** 日均需分 ≤ 8
- **THEN** 顯示「還有 N 天，平均每天需 X 分達標」

#### Scenario: 已難達標
- **WHEN** 日均需分 > 8
- **THEN** 顯示「為自己的心而做，能量會累積，不要放棄 💫」，不顯示不可能達到的日均數字為主訴求，不暗示本月目標仍可追回

---

### Requirement: 本月與豁免邊界
日均提醒 MUST 僅於本月現時視圖（`isCurrentMonth = true`）顯示。歷史月份（`isCurrentMonth = false`）MUST NOT 顯示（月已結束，無「接下來」可言）。本月豁免成員（不參與計分，`maxScore = 0`）MUST NOT 顯示日均提醒。

#### Scenario: 檢視歷史月份
- **WHEN** 學員檢視已結束的歷史月份
- **THEN** 不顯示日均提醒

#### Scenario: 本月豁免成員
- **WHEN** 學員本月不參與計分（豁免）
- **THEN** 不顯示日均提醒
