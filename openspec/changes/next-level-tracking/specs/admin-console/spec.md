## ADDED Requirements

### Requirement: 未選下月階梯名單查詢
`GET /api/admin/unselected-next-level?yearMonth=YYYY-MM` SHALL 回傳指定月份未選下月階梯的成員清單。查詢條件為 `monthly_summary.chose_next_level = false` AND 對應成員 `members.status != '停用'`。回傳每位成員：`{ id, name, level, joinDate, exempted, monthRate, monthPassing }`，其中 `exempted` 來自該列 `max_score = 0` 判定、`monthRate` 與 `monthPassing` 取自同列。`yearMonth` 缺省為「最近一個已月結月份」。

#### Scenario: 查詢已月結月份名單
- **WHEN** 管理員呼叫 `?yearMonth=2026-05`，5 月已月結
- **THEN** 回傳所有 `chose_next_level = false` 且 `status != '停用'` 的成員

#### Scenario: 已停用成員不出現
- **WHEN** 成員 `status = '停用'`
- **THEN** 即使 `chose_next_level = false` 也不在名單中

#### Scenario: 查詢未月結月份
- **WHEN** 管理員呼叫尚未月結的月份
- **THEN** API 回傳 200 但 `rows` 為空陣列，附 `notSettled: true` flag 供前端提示

---

### Requirement: 批次停用成員
`POST /api/admin/members/batch-deactivate` SHALL 接受 `{ memberIds: string[] }` 並依序對每個 ID 套用既有 `status = '停用'` 邏輯。回應 MUST 為 `{ ok: true, succeeded: string[], failed: { id: string, msg: string }[] }`。部分失敗（例如成員不存在或已停用）SHALL 不影響其他 ID 的處理。空陣列 SHALL 回傳 400。

#### Scenario: 全部成功
- **WHEN** `memberIds = ['M001', 'M002', 'M003']` 全為活躍成員
- **THEN** 三人均 `status = '停用'`，回應 `succeeded = ['M001', 'M002', 'M003']`、`failed = []`

#### Scenario: 部分失敗
- **WHEN** `memberIds = ['M001', 'M999']`，M999 不存在
- **THEN** M001 停用成功，M999 進 `failed`，回應 `succeeded = ['M001']`、`failed = [{ id: 'M999', msg: '...' }]`

#### Scenario: 空陣列
- **WHEN** 提交 `memberIds = []`
- **THEN** API 回傳 400 並提示需至少一個 ID

---

### Requirement: 罰款總結 Tab 「未選下月階梯」區塊
管理後台「罰款總結」Tab SHALL 在罰款月份選擇器下方新增「未選下月階梯」區塊，與罰款月份選擇器同步。每位成員列 SHALL 顯示：姓名、本月達成率、本月通關狀態、單筆「停用」按鈕。區塊頂部 SHALL 提供「全選」checkbox 與「批次停用」按鈕，點擊後彈出確認對話框，確認後呼叫批次 API。

#### Scenario: 罰款月份切換連動
- **WHEN** 管理員切換罰款月份從 5 月到 4 月
- **THEN** 「未選下月階梯」區塊也同步切換到 4 月名單

#### Scenario: 單筆停用
- **WHEN** 管理員點某成員的「停用」按鈕並確認
- **THEN** 呼叫 `PATCH /api/admin/members/[id]` `{ status: '停用' }`，名單立即移除該成員

#### Scenario: 批次停用
- **WHEN** 管理員勾選 3 人，點「批次停用」並確認
- **THEN** 呼叫 batch-deactivate API；成功的成員從名單移除，失敗者顯示 toast 錯誤

#### Scenario: 名單為空
- **WHEN** 該月份所有非停用成員均已選下月階梯
- **THEN** 區塊顯示「本月所有成員均已選擇下月階梯」字樣

#### Scenario: 歷史月份無 snapshot 提示
- **WHEN** 切換到 `chose_next_level` migration 之前的月份（資料皆 false）
- **THEN** 區塊頂部顯示提示「此月份月結前未啟用快照，名單僅供參考」

---

## MODIFIED Requirements

### Requirement: 罰款總結 Tab
`GET /api/admin/penalty?yearMonth=YYYY-MM` SHALL 回傳指定月份未通關成員清單與罰款金額。回應 MUST 同時包含「扣前 live 達成率」對照（即時 `calcMonthStats`）與「扣後 settled」資料，便於對照月結後變化。

`POST /api/admin/settlement` SHALL 接受 `{ yearMonth? }` 並呼叫 `runSettlement(db, yearMonth, today)` 執行月結，採 upsert 冪等。

`GET /api/admin/export?yearMonth=YYYY-MM` SHALL 回傳 UTF-8 BOM 開頭的 CSV，CSV 欄位 MUST 透過 `lib/csv.ts` 的 `csvField` / `csvRow` 跳脫公式注入字元（`= / + / - / @ / \t / \r`）。

「罰款總結」Tab 同時整合「未選下月階梯」區塊，與罰款月份選擇器連動（見 ADDED Requirement「罰款總結 Tab 「未選下月階梯」區塊」）。

#### Scenario: 查詢上個月罰款
- **WHEN** 管理員選擇 `yearMonth = 2026-04`
- **THEN** 回傳 4 月未通關成員列表 + 總計，每列含 `liveRate / liveTotal / settledTotal / penalty / whDeduction`

#### Scenario: 一鍵月結
- **WHEN** 管理員點「執行月結」並確認
- **THEN** `runSettlement` 執行，`monthly_summary` upsert 寫入（含 `chose_next_level` 快照），`members.level` 套用 `next_level`，月度成就觸發

#### Scenario: 匯出 CSV
- **WHEN** 管理員點「匯出 CSV」
- **THEN** 回應 `Content-Type: text/csv; charset=utf-8`，內容 BOM 開頭，所有欄位防注入跳脫

#### Scenario: 月份切換同步
- **WHEN** 管理員切換罰款月份選擇器
- **THEN** 罰款名單與「未選下月階梯」區塊同時切換到該月資料
