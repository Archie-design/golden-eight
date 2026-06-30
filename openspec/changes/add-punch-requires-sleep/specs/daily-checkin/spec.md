## ADDED Requirements

### Requirement: 破曉打拳前置條件——須同時完成早睡早起
打卡提交時，若 `tasks[1]`（破曉打拳）為 `true`，則 `tasks[0]`（早睡早起／子時入睡）MUST 也為 `true`。系統 SHALL 在 `POST /api/checkin/submit` 與 `PATCH /api/checkin/submit` 兩條路徑皆強制此規則，違反者 MUST 拒絕並回傳 400 與中文錯誤訊息「要打卡「破曉打拳」前，請先完成「早睡早起（子時入睡）」」。

此規則為同一筆打卡內的跨任務約束，MUST NOT 跨日比對前一日紀錄。「早睡早起」只要勾選即視為滿足，無論計分為 1 分（11 點前入睡）或 0.5 分（12 點前入睡，`early_sleep_half = true`）。此規則僅約束提交與修改的合法性，MUST NOT 影響 `calcBaseScore`、`punch_streak` 或成就計算。

#### Scenario: 有打拳但無早睡——拒絕
- **WHEN** 成員提交 `tasks[1] = true` 且 `tasks[0] = false`
- **THEN** API 回傳 400，訊息為「要打卡「破曉打拳」前，請先完成「早睡早起（子時入睡）」」，不寫入任何打卡紀錄

#### Scenario: 早睡與打拳皆勾選——成功
- **WHEN** 成員提交 `tasks[0] = true` 且 `tasks[1] = true`
- **THEN** 打卡正常成立，得分與 `punch_streak` 照常計算

#### Scenario: 早睡採 0.5 分仍視為滿足
- **WHEN** 成員提交 `tasks[0] = true`、`early_sleep_half = true`（12 點前入睡，0.5 分）且 `tasks[1] = true`
- **THEN** 打卡正常成立，不因 0.5 分而被拒

#### Scenario: 只勾早睡、未勾打拳——成功
- **WHEN** 成員提交 `tasks[0] = true` 且 `tasks[1] = false`
- **THEN** 打卡正常成立（規則只在打拳時觸發）

#### Scenario: 早睡與打拳皆未勾——成功
- **WHEN** 成員提交 `tasks[0] = false` 且 `tasks[1] = false`
- **THEN** 打卡正常成立（規則只在打拳時觸發）

#### Scenario: 修改打卡同樣套用前置條件
- **WHEN** 成員以 `PATCH` 將今日打卡改為 `tasks[1] = true` 且 `tasks[0] = false`
- **THEN** API 回傳 400 並拒絕修改，既有紀錄保持不變
