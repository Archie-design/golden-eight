## ADDED Requirements

### Requirement: 導覽列隱藏行程入口
行程功能目前**暫停對外入口**：主導覽列 MUST NOT 顯示「行程」連結。行程頁面（`/schedule`）、API（`app/api/schedule/*`）與既有成員資料（`schedule_template`）MUST 完整保留不動；此為「藏入口」而非移除功能。直接以網址造訪 `/schedule` MAY 仍可進入（本次僅移除導覽列入口，不擋直接訪問）。

#### Scenario: 導覽列不含行程
- **WHEN** 使用者檢視主導覽列
- **THEN** MUST NOT 出現「行程」連結

#### Scenario: 功能與資料保留
- **WHEN** 隱藏入口後檢視系統
- **THEN** `/schedule` 頁面、`app/api/schedule/*` 與 `schedule_template` 資料 MUST 完整保留，未被刪除
