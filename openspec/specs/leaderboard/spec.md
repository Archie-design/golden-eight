# Leaderboard Capability

## Purpose

提供成員間月度與歷史排行比較，包含本月即時達成率、扣分後重排（toggle）、歷史最佳月份排行。前三名 SHALL 有特殊樣式，破曉王 SHALL 附皇冠標示，並顯示成員的展示徽章與基本統計（階梯、最長連打、解鎖成就數）。

## Requirements

### Requirement: 雙模式排行
`/leaderboard` SHALL 提供兩種模式切換：

- **本月（current）**：依本月即時達成率排序，含月份左右切換鈕（右箭頭在當月時停用）
- **歷史最佳（best）**：每位成員歷史最高達成率月份，回傳該月 yearMonth

API: `GET /api/stats/leaderboard?mode=current|best&month=YYYY-MM`

#### Scenario: 切換到歷史最佳模式
- **WHEN** 使用者點選「歷史最佳」按鈕
- **THEN** 列表改為每位成員歷史單月最高達成率，欄位顯示對應 yearMonth

#### Scenario: 切換歷史月份
- **WHEN** 本月模式下按左箭頭切到上個月
- **THEN** 列表重新載入該月排序，右箭頭可用

#### Scenario: 無法切到未來月份
- **WHEN** 本月模式下嘗試右箭頭切到下個月
- **THEN** 右箭頭停用，請求被忽略

---

### Requirement: 排序與排名
本月模式 SHALL 依達成率降序排序；達成率相同時依姓名 localeCompare 次序。並列達成率成員 MUST 共享 rank（次一名跳號）。新進成員（`exempted = true`）與未月結（`settledRate IS NULL`）成員 SHALL 排於最後。

#### Scenario: 達成率並列
- **WHEN** 成員 A 與成員 B 達成率均為 75%
- **THEN** 兩人 rank 同值，下一位 rank 跳至兩人之後

#### Scenario: 新進成員排序
- **WHEN** 新進不參與計分的成員與其他成員一起列出
- **THEN** 新進成員顯示在列表底部，欄位顯示「不參與計分」

---

### Requirement: 扣分後 toggle
本月模式 SHALL 提供「扣分後」開關。開啟時系統 SHALL 改用 `monthly_summary.settled_*` 欄位（月結後分數），並依 `settledRate` 重新排序。未月結（`settledRate IS NULL`）成員 SHALL 顯示「未月結」字樣並排於最後。

#### Scenario: 扣分後 toggle 開啟
- **WHEN** 使用者開啟「扣分後」switch
- **THEN** 列表依 `settledRate` 重排，顯示扣分後達成率與工時扣分

#### Scenario: 部分成員未月結
- **WHEN** 開啟「扣分後」但部分成員無 `settled_total`
- **THEN** 那些成員顯示「未月結」並排於最後

---

### Requirement: Top 3 與破曉王視覺強調
排行榜前三名 SHALL 套用特殊樣式（金/銀/銅 ring + 王冠/獎牌 icon）。破曉王（`is_dawn_king = true`）SHALL 在姓名旁附 `Crown` icon 標示。

#### Scenario: 第一名
- **WHEN** 顯示 rank = 1 的成員
- **THEN** 卡片有金色 ring + 金色王冠 icon

#### Scenario: 破曉王標記
- **WHEN** 該成員當月為破曉王
- **THEN** 姓名旁顯示金色王冠 icon + `title="破曉王"`

---

### Requirement: 展示徽章
排行榜 SHALL 顯示成員的展示徽章（`showcaseCodes`，最多數枚），以 hexagonal `BadgeTile size="sm"` 樣式呈現於姓名行下方。徽章樣式 MUST 與成就牆主畫面一致（依難度分色、SVG hex 框架）。

#### Scenario: 顯示展示徽章
- **WHEN** 成員設定了展示徽章
- **THEN** 排行榜該成員行顯示徽章 + 名稱 pill

#### Scenario: 無展示徽章
- **WHEN** 成員未設定展示徽章
- **THEN** 該行不顯示徽章區塊

---

### Requirement: 排行榜資料欄位
每位成員的排行列 SHALL 包含以下欄位：

```ts
{
  rank: number,
  id: string,
  name: string,
  level: string,                  // 黃金/白銀/青銅戰士
  totalScore: number,
  maxScore: number | null,
  rate: number,                   // 0-100
  passing: boolean,
  maxStreak: number,              // 當月最長連打
  isDawnKing: boolean,
  achievementCount: number,
  yearMonth: string,              // best 模式下為達成最高的月份
  exempted: boolean,
  showcaseCodes: string[],
  settledTotal: number | null,
  settledRate: number | null,
  settledPassing: boolean | null,
  whDeduction: number | null,
}
```

#### Scenario: 載入排行榜
- **WHEN** 呼叫 `GET /api/stats/leaderboard?mode=current&month=2026-05`
- **THEN** 回傳 `{ ok: true, rows: LeaderRow[], yearMonth, currentYearMonth }`

---

### Requirement: 月份切換不可超過當月
本月模式 SHALL 從伺服器接收 `currentYearMonth`，前端 MUST 依此判斷右箭頭是否停用。`navigate(+1)` MUST 在 `next > maxMonth` 時拒絕切換。

#### Scenario: 當月鎖定右箭頭
- **WHEN** `selectedMonth` 等於 `maxMonth`
- **THEN** 右箭頭 disabled，aria-label 維持但不可點擊

---

## Data Source

主資料來源：`monthly_summary`（已月結月份）+ `checkin_records` + `members.level`（即時達成率）。`isDawnKing` 即時計算（current 當月）或讀 `monthly_summary.is_dawn_king`（best / 歷史月）。

## Notes

- 排行榜分組行為：所有成員（不分階梯）共用同一排行表
- 顯示密度：每列卡片高度約 4 行（rank + 姓名/階梯 + 展示徽章 + 副統計）
