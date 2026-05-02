## ADDED Requirements

### Requirement: 夥伴卡片資訊快照
GET `/api/partners` SHALL 回傳所有已接受夥伴的當日快照，包含：今日是否打卡（`todayChecked`）、今日完成任務（`todayTasks: boolean[8] | null`）、本月達成率（`monthRate`）、本月得分（`monthScore`）、目前連續天數（`punchStreak`）。查詢以批次方式進行，不得對每位夥伴發起獨立查詢（避免 N+1）。

#### Scenario: 夥伴已打卡時的快照
- **WHEN** 成員 A 呼叫 GET `/api/partners`，夥伴 B 今日已打卡
- **THEN** B 的卡片 `todayChecked: true`，`todayTasks` 為 8 格布林陣列

#### Scenario: 夥伴未打卡時的快照
- **WHEN** 夥伴 B 今日尚未打卡
- **THEN** B 的卡片 `todayChecked: false`，`todayTasks: null`

#### Scenario: 批次查詢效能
- **WHEN** 成員有 10 位夥伴
- **THEN** API 以單次或少量 IN 查詢完成，不得執行 10 次獨立查詢

---

### Requirement: Dashboard 夥伴動態區塊
Dashboard 頁面 SHALL 在現有內容下方顯示「夥伴動態」區塊，展示最多 3 位夥伴的精簡資訊（姓名、今日打卡狀態、本月達成率）。若無夥伴，SHALL 顯示引導卡片「邀請第一位夥伴」。

#### Scenario: 有夥伴時顯示動態
- **WHEN** 成員有至少 1 位夥伴，載入 Dashboard
- **THEN** 顯示最多 3 位夥伴的精簡卡，含「查看全部」連結至 `/partners`

#### Scenario: 無夥伴時顯示引導
- **WHEN** 成員尚無任何夥伴，載入 Dashboard
- **THEN** 顯示引導卡片，提示邀請第一位夥伴，含連結至 `/partners`

---

### Requirement: 夥伴搜尋
成員 SHALL 能依姓名模糊搜尋可邀請成員（排除自己與現有夥伴）。

#### Scenario: 搜尋到可邀請成員
- **WHEN** 成員輸入姓名關鍵字
- **THEN** 回傳最多 10 筆符合的成員（含姓名、階級），排除自己及現有夥伴關係

#### Scenario: 搜尋無結果
- **WHEN** 關鍵字無符合成員
- **THEN** 回傳空陣列
