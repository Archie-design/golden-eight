## ADDED Requirements

### Requirement: 月結扣除請假日並可重現
月結計算每位成員該月達成率、達標、罰款時，分母 MUST 扣除該月的請假天數。請假資料以 `leave_records` 持久化，月結 MUST 據此計算，且重跑同一月的月結 MUST 得到一致的分母與結果（可重現）。

#### Scenario: 月結分母扣請假
- **WHEN** 某成員該月有 N 天請假
- **THEN** 月結的達成率分母為 (有效天數 − N) × 8，達標與罰款依此計算

#### Scenario: 重跑一致
- **WHEN** 重跑同一月的月結
- **THEN** 因 leave_records 為持久化事實，分母與結果與前次一致
