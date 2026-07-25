## ADDED Requirements

### Requirement: 社交類成就
系統 SHALL 在成員接受邀請（或被接受）後，計算目前 accepted 夥伴數，依達成條件解鎖對應成就。

| code | 條件 |
|------|------|
| `PARTNER_FIRST` | 初結夥伴：擁有 ≥ 1 位夥伴 |
| `PARTNER_3` | 黃金同行：擁有 ≥ 3 位夥伴 |
| `PARTNER_5` | 戰隊成形：擁有 ≥ 5 位夥伴 |

#### Scenario: 接受第一位夥伴
- **WHEN** 成員接受邀請後，accepted 夥伴數首次達到 1
- **THEN** 解鎖 `PARTNER_FIRST`

#### Scenario: 達到 5 位夥伴
- **WHEN** 成員接受邀請後，accepted 夥伴數首次達到 5
- **THEN** 解鎖 `PARTNER_3` 和 `PARTNER_5`（若尚未解鎖）

---

### Requirement: 競爭類成就
系統 SHALL 在成員提交打卡後，比較本人與所有夥伴的統計數據，解鎖競爭成就。比較基準為「任一夥伴」（超越任一位即可）。

| code | 條件 |
|------|------|
| `PARTNER_BEAT_RATE` | 後來居上：本月達成率高於任一夥伴 |
| `PARTNER_BEAT_STREAK` | 連續超越：我的 punch_streak 高於任一夥伴 |

#### Scenario: 本月達成率超越夥伴
- **WHEN** 成員提交打卡後，本月達成率首次超越至少一位夥伴
- **THEN** 解鎖 `PARTNER_BEAT_RATE`

#### Scenario: 連續天數超越夥伴
- **WHEN** 成員提交打卡後，punch_streak 首次超越至少一位夥伴的 streak
- **THEN** 解鎖 `PARTNER_BEAT_STREAK`

---

### Requirement: 同步類成就
系統 SHALL 在成員提交打卡後，對每位夥伴計算 `calcPartnerSyncStreak`，若連續同日打卡天數達標則解鎖對應成就。

| code | 條件 |
|------|------|
| `PARTNER_SYNC_7` | 七日同行：與任一夥伴連續同日打卡 ≥ 7 天 |
| `PARTNER_SYNC_30` | 同行三十日：與任一夥伴連續同日打卡 ≥ 30 天 |

#### Scenario: 與夥伴連續打卡 7 天
- **WHEN** 成員與夥伴連續同日打卡首次達到 7 天
- **THEN** 解鎖 `PARTNER_SYNC_7`

---

### Requirement: 鼓勵類成就
系統 SHALL 在送出或收到鼓勵後，計算累積數量，達標時解鎖對應成就。

| code | 條件 |
|------|------|
| `PARTNER_CHEER_10` | 加油大使：累積送出 ≥ 10 次鼓勵 |
| `PARTNER_CHEERED_10` | 人氣戰士：累積收到 ≥ 10 次鼓勵 |

#### Scenario: 送出累積達 10 次鼓勵
- **WHEN** 成員送出第 10 次鼓勵
- **THEN** 解鎖 `PARTNER_CHEER_10`

#### Scenario: 收到累積達 10 次鼓勵
- **WHEN** 成員收到第 10 次鼓勵（由任意夥伴送出）
- **THEN** 解鎖 `PARTNER_CHEERED_10`
