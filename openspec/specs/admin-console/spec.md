# Admin Console Capability

## Purpose

提供管理員專用後台，集中處理全員進度監看、罰款查詢與 CSV 匯出、月結觸發、成就稀有度分析、會員管理（新增/停用/重置密碼）。所有 admin 路由 MUST 透過 `requireAdmin()` 守衛，每次重新查詢 `is_admin` 不信任 JWT payload。

## Requirements

### Requirement: Admin 守衛
所有 `/api/admin/*` 路由 MUST 透過 `requireAdmin()` 包裝。`requireAdmin()` MUST：

1. 先呼叫 `getCurrentMember()` 驗證 JWT
2. 從資料庫重新查詢 `members.is_admin` 欄位
3. 若 `is_admin = false` 回傳 403

JWT payload 中的 `isAdmin` claim 僅供前端 UI 提示用，後端 MUST 不信任。

#### Scenario: 一般成員存取 admin API
- **WHEN** `is_admin = false` 的成員呼叫 `/api/admin/penalty`
- **THEN** API 回傳 403

#### Scenario: 管理員權限被撤銷
- **WHEN** 成員的 `is_admin` 被改為 false 但 JWT 尚未過期
- **THEN** `requireAdmin()` 從 DB 確認後拒絕，回傳 403

---

### Requirement: 全員進度 Tab
`GET /api/stats/progress`（admin 限定）SHALL 回傳全員當月進度：姓名、階梯、累計得分、達成率、最長連打、是否破曉王。`/admin` 頁面 SHALL 以表格形式呈現，並提供階梯/達成率排序。

#### Scenario: 載入全員進度
- **WHEN** 管理員開啟「全員進度」Tab
- **THEN** 表格顯示所有活躍成員，含階梯顏色標籤與破曉王皇冠

---

### Requirement: 罰款總結 Tab
`GET /api/admin/penalty?yearMonth=YYYY-MM` SHALL 回傳指定月份未通關成員清單與罰款金額。回應 MUST 同時包含「扣前 live 達成率」對照（即時 `calcMonthStats`）與「扣後 settled」資料，便於對照月結後變化。

`POST /api/admin/settlement` SHALL 接受 `{ yearMonth? }` 並呼叫 `runSettlement(db, yearMonth, today)` 執行月結，採 upsert 冪等。

`GET /api/admin/export?yearMonth=YYYY-MM` SHALL 回傳 UTF-8 BOM 開頭的 CSV，CSV 欄位 MUST 透過 `lib/csv.ts` 的 `csvField` / `csvRow` 跳脫公式注入字元（`= / + / - / @ / \t / \r`）。

#### Scenario: 查詢上個月罰款
- **WHEN** 管理員選擇 `yearMonth = 2026-04`
- **THEN** 回傳 4 月未通關成員列表 + 總計，每列含 `liveRate / liveTotal / settledTotal / penalty / whDeduction`

#### Scenario: 一鍵月結
- **WHEN** 管理員點「執行月結」並確認
- **THEN** `runSettlement` 執行，`monthly_summary` upsert 寫入，`members.level` 套用 `next_level`，月度成就觸發

#### Scenario: 匯出 CSV
- **WHEN** 管理員點「匯出 CSV」
- **THEN** 回應 `Content-Type: text/csv; charset=utf-8`，內容 BOM 開頭，所有欄位防注入跳脫

---

### Requirement: 全員打卡明細匯出
`GET /api/admin/export-records`（admin 限定）SHALL 匯出全員跨月份的逐日打卡明細 CSV。系統 MUST 接受可選查詢參數 `startMonth`、`endMonth`（皆為 `YYYY-MM` 格式）限定匯出範圍；省略任一或兩者時，MUST 匯出該成員全部歷史紀錄（不設時間下限/上限）。

系統 MUST 另接受可選查詢參數 `memberIds`（逗號分隔的成員編號清單，例如 `M001,M003`）限定匯出對象；省略時 MUST 匯出全部成員（與既有行為一致）。`memberIds` 篩選 MUST 可與 `startMonth`/`endMonth` 同時套用。

#### Scenario: 匯出全部歷史
- **WHEN** 管理員呼叫 `GET /api/admin/export-records`（不帶 `startMonth`/`endMonth`）
- **THEN** 回傳 CSV 含所有成員的所有歷史打卡紀錄，每列一筆 `checkin_records`

#### Scenario: 匯出指定月份範圍
- **WHEN** 管理員呼叫 `GET /api/admin/export-records?startMonth=2026-04&endMonth=2026-06`
- **THEN** 回傳 CSV 僅含 2026-04-01 至 2026-06-30（含）之間的打卡紀錄

#### Scenario: 非管理員存取
- **WHEN** 非管理員成員呼叫 `GET /api/admin/export-records`
- **THEN** 回傳 403（`requireAdmin()` 守衛，與其餘 `/api/admin/*` 路由一致）

#### Scenario: 匯出指定成員
- **WHEN** 管理員呼叫 `GET /api/admin/export-records?memberIds=M001`
- **THEN** 回傳 CSV 僅含 M001 的打卡紀錄

#### Scenario: 匯出指定成員 + 指定月份範圍
- **WHEN** 管理員呼叫 `GET /api/admin/export-records?memberIds=M001,M003&startMonth=2026-10&endMonth=2026-11`
- **THEN** 回傳 CSV 僅含 M001 與 M003 在 2026-10-01 至 2026-11-30（含）之間的打卡紀錄

#### Scenario: 不帶 memberIds 維持匯出全員
- **WHEN** 管理員呼叫 `GET /api/admin/export-records`（不帶 `memberIds`）
- **THEN** 回傳 CSV 含所有成員的紀錄，行為與本次變更前一致

---

### Requirement: 打卡明細 CSV 欄位
CSV 每一列 MUST 代表一位成員某一天的 `checkin_records`，欄位依序為：成員編號、姓名、日期、8 項任務各自的勾選狀態（是/否）、`base_score`、`punch_bonus`、`total_score`、`punch_streak`、`work_hours`、`note`、`run_minutes`、`run_km`、`submit_time`。

CSV 輸出 MUST 透過 `lib/csv.ts` 的 `csvField`/`csvRow` 逐欄跳脫，阻擋公式注入字元（`= / + / - / @ / \t / \r`），比照 `GET /api/admin/export` 的既有輸出慣例：UTF-8 BOM 開頭、`Content-Disposition: attachment`。

#### Scenario: 欄位完整呈現一筆紀錄
- **WHEN** 某成員某日完成 8 項任務中的 5 項，`work_hours = 8`，有備註
- **THEN** CSV 該列正確呈現該 5 項為「是」、其餘 3 項為「否」，以及 `work_hours`、`note` 等其餘欄位值

#### Scenario: 防公式注入
- **WHEN** 某筆紀錄的 `note` 欄位內容為 `=HYPERLINK(...)` 等以公式觸發字元開頭的字串
- **THEN** CSV 輸出該欄位值前綴單引號跳脫，Excel 開啟時不會被當成公式執行

---

### Requirement: 管理後台觸發入口
管理後台「罰款總結」Tab SHALL 提供觸發全員打卡明細匯出的按鈕，點擊後直接下載 CSV，不需額外跳轉或輸入參數。

管理後台 SHALL 另提供一個可選的多選成員篩選介面，置於匯出按鈕旁。未勾選任何成員時，點擊匯出按鈕 MUST 維持匯出全員的行為；勾選一位或多位成員後，匯出 MUST 僅含勾選成員的紀錄。

#### Scenario: 管理後台觸發匯出
- **WHEN** 管理員於「罰款總結」Tab 點擊「全部紀錄 CSV」按鈕
- **THEN** 瀏覽器下載該 CSV 檔案

#### Scenario: 管理後台觸發匯出（未勾選成員，維持全員）
- **WHEN** 管理員於「罰款總結」Tab 未勾選任何成員，點擊「全部紀錄 CSV」按鈕
- **THEN** 瀏覽器下載含全員紀錄的 CSV 檔案

#### Scenario: 管理後台觸發匯出（指定成員）
- **WHEN** 管理員於「罰款總結」Tab 勾選 1 位成員，點擊「全部紀錄 CSV」按鈕
- **THEN** 瀏覽器下載僅含該成員紀錄的 CSV 檔案

---

### Requirement: 成就統計 Tab
`GET /api/admin/achievements` SHALL 回傳每項成就的稀有度（`unlockedCount` / `totalMembers`）與每位成員的解鎖數。`/admin` 成就 Tab SHALL 以稀有度升序排序展示成就清單，並提供成員解鎖矩陣。

#### Scenario: 載入成就統計
- **WHEN** 管理員開啟「成就統計」Tab
- **THEN** 顯示每項成就的解鎖人數 / 總人數百分比；最稀有的成就排在最上

---

### Requirement: 會員管理 Tab
管理員 SHALL 能執行以下操作：

- `POST /api/admin/members` `{ name, phone, joinDate, level }`：新增會員
- `PATCH /api/admin/members/[id]` `{ status: '停用' }`：停用會員
- `POST /api/admin/members/[id]/reset-password` `{ name, phone, password }`：重置密碼

重置密碼操作 MUST 要求成員本人現場提供姓名 + 完整手機作為二次驗證，後端比對 `name` 與 `phone_hash` 後才允許更新。

#### Scenario: 新增會員
- **WHEN** 管理員提交 `{ name: '王小明', phone: '0912345678', joinDate: '2026-05-01', level: '青銅戰士' }`
- **THEN** `members` 新增列，`effective_start_date` 依加入時間 12:00 規則設定

#### Scenario: 停用會員
- **WHEN** 管理員 PATCH `{ status: '停用' }`
- **THEN** `members.status = '停用'`，該成員下次登入回 401

#### Scenario: 重置密碼（驗證失敗）
- **WHEN** 管理員提交的 `name` 或 `phone` 與 DB 不符
- **THEN** API 回傳 400，密碼不變

#### Scenario: 重置密碼（成功）
- **WHEN** `name` + `phone_hash` 比對通過
- **THEN** `password_hash` 更新，`token_version` 遞增（撤銷既有 JWT）

---

### Requirement: 回填歷史成就
`POST /api/admin/backfill-achievements` SHALL 重新計算所有成員的成就解鎖狀態並補寫缺漏。此 API 為一次性遷移工具，主要用於：

- v1.3 修正 `MONTH_STREAK_3 / MONTH_STREAK_6` 後，補發應獲獎成員的成就
- 既有資料異常修復

回填 MUST 為冪等操作（UNIQUE(member_id, code) 自動防重複）。

#### Scenario: 回填月度連勝
- **WHEN** v1.3 部署後管理員執行 backfill
- **THEN** 累計 ≥ 3 次通關但未解鎖 `MONTH_STREAK_3` 的成員自動補發

---

## Data Source

主要查詢：`members`、`monthly_summary`、`checkin_records`、`achievements`、`tag_library`。`/api/admin/penalty` 同時呼叫 `calcMonthStats` 計算 live 對照值。

## Rate Limiting

Admin API 不額外限流（已透過 `requireAdmin()` 強制管理員身分）。

## Notes / Limitations

- 假設成員 ≤ 200 人，未實作分頁
- 重置密碼為「管理員協助 + 成員現場驗證」模式，無 email/SMS 重置流程
