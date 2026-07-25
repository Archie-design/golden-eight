## ADDED Requirements

### Requirement: 每日狀態快照的產生時機與邏輯日歸屬
系統 SHALL 於每日 **12:30（台北）** 執行 `/api/cron/daily-digest`，對「剛截止的邏輯日」`D` 產生全員狀態快照。

`D` MUST 取 `getCheckinDayTaipei()` 的**前一日**：cron 在 12:00 之後執行，`getCheckinDayTaipei()` 已翻為新的邏輯日（今日），而剛截止的是其前一日。直接使用 `getCheckinDayTaipei()` 會把「才剛開始 30 分鐘的邏輯日」誤判為全員漏卡。

排程 MUST 晚於 12:00，因打卡邏輯日以中午 12:00 為界，該時刻前成員仍可補打前一日的卡；12:30 保留 30 分鐘 buffer，與月結 cron 排在 13:00 的理由一致。

路由 MUST 驗證 `Authorization: Bearer ${CRON_SECRET}`，未通過回 401。

#### Scenario: 12:30 執行取前一邏輯日
- **WHEN** cron 於 7/03 12:30（台北）執行，`getCheckinDayTaipei()` 回傳 `2026-07-03`
- **THEN** 快照的目標邏輯日 `D` 為 `2026-07-02`

#### Scenario: 未帶 CRON_SECRET
- **WHEN** 呼叫 `/api/cron/daily-digest` 未帶或帶錯 Bearer token
- **THEN** 回傳 401，不產生任何快照、不推播

---

### Requirement: 快照內容為當下事實且不可重算
`daily_status_snapshot` SHALL 對每位活躍成員、每個邏輯日記錄一列，內容包含：`missed`（該日是否無打卡紀錄）、`miss_streak`（截至該日的連續缺卡天數，有打卡為 0）、`rate`（該日當下的累計月達成率）、`passing`（該日當下是否達其階梯門檻）。

`rate` / `passing` MUST 為寫入當下計算的事實快照，MUST NOT 於日後因補登、月結、工時修正或重跑而被重算覆蓋為不同值。此與 `monthly_summary.level` 快照同一原則：歷史以當下記錄為準，不由現況回推。

唯一鍵 MUST 為 `(date, member_id)`。

#### Scenario: 快照記錄當下達成率
- **WHEN** 邏輯日 D 產生快照時該成員累計達成率為 58%
- **THEN** `snapshot[D].rate = 58`，且日後即使該成員補登 D 之前的紀錄使實際達成率改變，`snapshot[D].rate` 仍為 58

#### Scenario: 連續缺卡天數累進
- **WHEN** 成員於 D-1 已 `miss_streak = 2`，且 D 日仍無打卡紀錄
- **THEN** `snapshot[D].missed = true` 且 `snapshot[D].miss_streak = 3`

#### Scenario: 有打卡則連續缺卡歸零
- **WHEN** 成員於 D 日有打卡紀錄
- **THEN** `snapshot[D].missed = false` 且 `snapshot[D].miss_streak = 0`

---

### Requirement: 新進豁免成員不計漏卡
起算日尚未到達的成員 MUST NOT 被判定為漏卡。當邏輯日 `D < effective_start_date`（無此欄位時退回 `join_date`）時，系統 MUST NOT 為該成員產生該日快照列，亦 MUST NOT 將其列入摘要的漏卡或風險名單。

此與工時補扣分母、`calcMonthStats` 計分分母依 `effective_start_date` 縮減的規則同源：成員尚未加入的日子不是他的缺席。

#### Scenario: 起算日前不算漏卡
- **WHEN** 成員 `effective_start_date = 2026-06-21`，處理邏輯日 `2026-06-20`
- **THEN** 該成員不產生 `2026-06-20` 的快照列，且不出現在該日摘要的漏卡名單

#### Scenario: 起算日當日起納入
- **WHEN** 成員 `effective_start_date = 2026-06-21`，處理邏輯日 `2026-06-21` 且該日無打卡紀錄
- **THEN** 產生快照列且 `missed = true`

---

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

`LONG_ABSENCE_DAYS` 預設為 **7**，MUST 定義為常數以便調整。

#### Scenario: 連續缺卡累進不報事件
- **WHEN** 成員 D-1 `miss_streak = 12`，D `miss_streak = 13`（未跨越門檻）
- **THEN** 不產生任何變化事件；該成員僅計入「長期缺席」摺疊計數

#### Scenario: 開始缺卡觸發事件
- **WHEN** 成員 D-1 有打卡、D 無打卡
- **THEN** 產生「開始缺卡」事件

#### Scenario: 跨越長期缺席門檻觸發一次
- **WHEN** 成員 D-1 `miss_streak = 6`，D `miss_streak = 7`（`LONG_ABSENCE_DAYS = 7`）
- **THEN** 產生「轉入長期缺席」事件；其後續每日累進不再產生事件

#### Scenario: 首日無前一日快照
- **WHEN** 處理邏輯日 D 而 `snapshot[D-1]` 不存在（功能首次啟用）
- **THEN** 系統 MUST NOT 為全員產生變化事件（避免首日爆量誤報），僅寫入 `snapshot[D]` 並推播不含變化區塊的摘要

---

### Requirement: 摘要內容與長期缺席摺疊
摘要 SHALL 依序包含：**變化事件**（⚡，當日新發生者）、**當日漏卡名單**、**門檻風險名單**（未達標且未長期缺席者，含當下 `rate` 與所需門檻）、**長期缺席摺疊行**、**當日完成人數與全月平均**。

`miss_streak >= LONG_ABSENCE_DAYS` 的成員 MUST 從漏卡與風險名單中移除，改以單行「長期缺席 N 人（姓名…）」呈現。

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

---

### Requirement: 推播對象與投遞
系統 SHALL 透過 LINE Messaging API 將摘要推播給 `is_admin = true`、`status = '活躍'` 且 `line_user_id` 非空的成員。

推播 MUST 使用 `LINE_CHANNEL_ACCESS_TOKEN`（Messaging API channel）。既有的 `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` 屬 LINE Login channel，用途不同，MUST NOT 用於推播。

個別收件人推播失敗 MUST NOT 中斷其他收件人的投遞，亦 MUST NOT 使快照寫入失效；失敗 MUST 寫入 log。

#### Scenario: 僅推播給已綁定的管理員
- **WHEN** 系統有 3 位管理員皆已綁定 LINE、17 位非管理員成員
- **THEN** 僅對該 3 位管理員推播，非管理員不收到

#### Scenario: 未綁定的管理員略過
- **WHEN** 一位管理員 `line_user_id` 為空
- **THEN** 略過該收件人，其餘管理員照常收到，不拋出錯誤

#### Scenario: 單一收件人失敗不影響其他
- **WHEN** 對第一位管理員推播回傳錯誤
- **THEN** 記錄錯誤並繼續推播其餘管理員，快照資料保持已寫入

---

### Requirement: 同日重跑冪等
重複執行同一邏輯日的 digest MUST NOT 產生重複快照列，亦 MUST NOT 重複推播。

快照寫入 MUST 以 `(date, member_id)` upsert。推播 MUST 依 `pushed_at` 判斷：該日快照已標記推播完成者，重跑時 MUST NOT 再次推播。

#### Scenario: 同日重跑不重複推播
- **WHEN** 同一邏輯日的 digest 已成功推播後再次被觸發
- **THEN** 快照以 upsert 覆蓋不產生重複列，且不再送出第二則推播

#### Scenario: 推播失敗後重跑可補送
- **WHEN** 前次執行快照已寫入但推播失敗（`pushed_at` 未標記）
- **THEN** 重跑時 MUST 重新嘗試推播
