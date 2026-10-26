# Spec Delta

## MODIFIED Requirements

### Requirement: 快照內容為當下事實且不可重算
`daily_status_snapshot` SHALL 對每位活躍成員、每個邏輯日記錄一列，內容包含：`missed`（該日是否無打卡紀錄且非請假）、`miss_streak`（截至該日的連續缺卡天數，有打卡或請假為不累進）、`rate`（該日當下的累計月達成率）、`passing`（該日當下是否達其階梯門檻）、`is_leave`（該日是否請假）。

`rate` / `passing` / `is_leave` MUST 為寫入當下計算的事實快照，MUST NOT 於日後因補登、月結、工時修正或重跑而被重算覆蓋為不同值。此與 `monthly_summary.level` 快照同一原則：歷史以當下記錄為準，不由現況回推。

請假日 SHALL 比照「如同該日不存在」原則：`missed` MUST 為 `false`（不計入漏卡），`miss_streak` MUST 延續前一日數值、不累進也不歸零（既非開始缺卡，也非恢復打卡）。

唯一鍵 MUST 為 `(date, member_id)`。

#### Scenario: 快照記錄當下達成率
- **WHEN** 邏輯日 D 產生快照時該成員累計達成率為 58%
- **THEN** `snapshot[D].rate = 58`，且日後即使該成員補登 D 之前的紀錄使實際達成率改變，`snapshot[D].rate` 仍為 58

#### Scenario: 連續缺卡天數累進
- **WHEN** 成員於 D-1 已 `miss_streak = 2`，且 D 日仍無打卡紀錄且未請假
- **THEN** `snapshot[D].missed = true` 且 `snapshot[D].miss_streak = 3`

#### Scenario: 有打卡則連續缺卡歸零
- **WHEN** 成員於 D 日有打卡紀錄
- **THEN** `snapshot[D].missed = false`、`snapshot[D].miss_streak = 0`、`snapshot[D].is_leave = false`

#### Scenario: 請假日不計漏卡且不累進連續缺卡
- **WHEN** 成員於 D-1 已 `miss_streak = 2`，D 日請假（無打卡紀錄但有 `leave_records`）
- **THEN** `snapshot[D].missed = false`、`snapshot[D].miss_streak = 2`（延續 D-1 數值，不累進）、`snapshot[D].is_leave = true`

#### Scenario: 請假結束後恢復累進
- **WHEN** 成員 D-2 `miss_streak = 2`，D-1 請假（`miss_streak` 延續為 2），D 日仍無打卡且未請假
- **THEN** `snapshot[D].miss_streak = 3`（從請假前的 2 繼續累進，等同請假日未發生）

### Requirement: 狀態變化事件判定
系統 SHALL 比對 `snapshot[D]` 與 `snapshot[D-1]`，產生「狀態變化事件」。事件類型 MUST 涵蓋：

| 事件 | 條件 |
|---|---|
| 開始缺卡 | D-1 `missed = false` 且 D `missed = true` |
| 回歸 | D-1 `missed = true` 且 D `missed = false` |
| 跌破門檻 | D-1 `passing = true` 且 D `passing = false` |
| 回到門檻 | D-1 `passing = false` 且 D `passing = true` |
| 轉入長期缺席 | D-1 `miss_streak < LONG_ABSENCE_DAYS` 且 D `miss_streak >= LONG_ABSENCE_DAYS` |

連續缺卡由 `N` 累進至 `N+1`（未跨越 `LONG_ABSENCE_DAYS` 邊界）MUST NOT 產生事件。此為防止長期未打卡者每日重複觸發、造成告警疲乏的核心機制。

請假日 MUST NOT 觸發「開始缺卡」或「回歸」事件：由於請假日 `missed = false`（見「快照內容為當下事實且不可重算」），比對邏輯天然不會因請假而誤報「回歸」；但系統仍 MUST 確保請假當日不因 `missed` 從 `true`（缺卡中）變為 `false`（請假不計入漏卡）而被誤判為「回歸」——此類轉移 MUST 被抑制，直到成員真正重新打卡才觸發「回歸」事件。

`LONG_ABSENCE_DAYS` 預設為 **7**，MUST 定義為常數以便調整。

#### Scenario: 連續缺卡累進不報事件
- **WHEN** 成員 D-1 `miss_streak = 12`，D `miss_streak = 13`（未跨越門檻）
- **THEN** 不產生任何變化事件；該成員僅計入「長期缺席」摺疊計數

#### Scenario: 開始缺卡觸發事件
- **WHEN** 成員 D-1 有打卡、D 無打卡且未請假
- **THEN** 產生「開始缺卡」事件

#### Scenario: 跨越長期缺席門檻觸發一次
- **WHEN** 成員 D-1 `miss_streak = 6`，D `miss_streak = 7`（`LONG_ABSENCE_DAYS = 7`）
- **THEN** 產生「轉入長期缺席」事件；其後續每日累進不再產生事件

#### Scenario: 首日無前一日快照
- **WHEN** 處理邏輯日 D 而 `snapshot[D-1]` 不存在（功能首次啟用）
- **THEN** 系統 MUST NOT 為全員產生變化事件（避免首日爆量誤報），僅寫入 `snapshot[D]` 並推播不含變化區塊的摘要

#### Scenario: 缺卡中請假不誤報回歸
- **WHEN** 成員 D-1 `missed = true`（缺卡中），D 日請假（`missed = false`、`is_leave = true`）
- **THEN** MUST NOT 產生「回歸」事件（成員仍未實際打卡，只是這天請假）

#### Scenario: 請假後真正缺卡才觸發開始缺卡
- **WHEN** 成員 D-1 請假（`missed = false`、`is_leave = true`），D 日無打卡且未請假
- **THEN** 因 D-1 `missed = false` 且 D `missed = true`，產生「開始缺卡」事件

### Requirement: 摘要內容與長期缺席摺疊
摘要 SHALL 依序包含：**變化事件**（⚡，當日新發生者）、**當日漏卡名單**、**當日請假名單**（📝）、**門檻風險名單**（未達標且未長期缺席者，含當下 `rate` 與所需門檻）、**長期缺席摺疊行**、**當日完成人數與全月平均**。

`miss_streak >= LONG_ABSENCE_DAYS` 的成員 MUST 從漏卡與風險名單中移除，改以單行「長期缺席 N 人（姓名…）」呈現。

`is_leave = true` 的成員 MUST 從漏卡名單中排除，改列於「當日請假名單」，MUST 顯示請假事由。

管理員自身的學員狀態 MUST NOT 被排除；管理員同時為學員，其漏卡與風險照常列入名單。

#### Scenario: 長期缺席者摺疊
- **WHEN** 某成員 `miss_streak = 20`（≥ 7）
- **THEN** 該成員不出現在漏卡明細與風險名單，僅計入「長期缺席」摺疊行

#### Scenario: 管理員自身列入
- **WHEN** 一位 `is_admin = true` 的成員當日漏卡
- **THEN** 該成員照常出現在漏卡名單中

#### Scenario: 無變化事件仍推播
- **WHEN** 當日所有成員皆無狀態變化
- **THEN** 仍推播摘要，變化區塊顯示為無異動，其餘區塊照常呈現

#### Scenario: 請假者從漏卡名單排除並列入請假名單
- **WHEN** 成員 D 日請假（事由「大堂課請假」），`is_leave = true`
- **THEN** 該成員不出現在「❌ 漏卡」名單，出現在「📝 今日請假」名單並顯示事由「大堂課請假」

#### Scenario: 無人請假時不顯示請假區塊
- **WHEN** D 日全員皆無請假紀錄
- **THEN** 摘要不顯示「📝 今日請假」區塊（或顯示為空，依既有「無」區塊慣例呈現）
