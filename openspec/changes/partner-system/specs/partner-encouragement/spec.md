## ADDED Requirements

### Requirement: 送出鼓勵
成員 SHALL 能對每位夥伴每個台北打卡日送出一次鼓勵。系統 SHALL 以 `encouragements(from_id, to_id, date)` UNIQUE 約束防止同日重複。成功送出後，鼓勵按鈕 SHALL 變為 disabled 狀態。

#### Scenario: 成功送出鼓勵
- **WHEN** 成員 A 對夥伴 B 送出鼓勵（今日尚未鼓勵過 B）
- **THEN** `encouragements` 新增記錄，API 回傳 200，前端按鈕轉為 disabled

#### Scenario: 同日重複鼓勵被阻止
- **WHEN** 成員 A 今日已鼓勵過夥伴 B，再次嘗試送出
- **THEN** DB UNIQUE 約束觸發，API 回傳 409，按鈕維持 disabled

#### Scenario: 對非夥伴送出鼓勵
- **WHEN** 成員嘗試對非夥伴成員送出鼓勵
- **THEN** API 驗證夥伴關係，回傳 403

---

### Requirement: 顯示鼓勵狀態
夥伴卡片 SHALL 顯示：我今天是否已鼓勵對方（`encouragedToday`）、對方今天是否已鼓勵我（`cheeredByToday`）。

#### Scenario: 查看已互相鼓勵的夥伴
- **WHEN** A 鼓勵了 B，B 也鼓勵了 A，A 載入夥伴清單
- **THEN** B 的卡片顯示 `encouragedToday: true`，`cheeredByToday: true`

#### Scenario: 查看未鼓勵的夥伴
- **WHEN** 今日尚未與夥伴互動
- **THEN** 卡片顯示 `encouragedToday: false`，`cheeredByToday: false`，鼓勵按鈕可點擊
