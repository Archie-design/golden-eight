# Schedule Template Capability

## Purpose

成員可以建立每日行程模板，由若干「時間區段」組成，每段附帶開始/結束時間、標籤（系統 14 + 自訂）、備註。模板可選擇公開（群組行程瀏覽）或私密。提供列表與時間軸兩種視圖、拖拉互動、跨午夜處理、原子化儲存。

## Requirements

### Requirement: 標籤庫
系統 SHALL 提供 14 筆預設系統標籤，定義於 `tag_library.is_system = true`：

- T001–T008：對應八項每日任務
- T009–T014：起床、刷牙、早餐、午餐、晚餐、休息

成員 SHALL 能新增自訂標籤（`POST /api/schedule/tag`），ID 格式 `U{memberId}_xxx`。系統標籤 MUST 不可刪除；自訂標籤 MUST 僅成員自己可刪除。

#### Scenario: 列出標籤庫
- **WHEN** 成員開啟 `/schedule`，呼叫 `GET /api/schedule/data`
- **THEN** 回傳 14 筆系統標籤 + 該成員所有自訂標籤

#### Scenario: 新增自訂標籤
- **WHEN** 成員提交 `{ tagName, color, emoji? }`
- **THEN** `tag_library` 新增 `is_system = false` 的列，回傳新標籤 ID

#### Scenario: 嘗試刪除系統標籤
- **WHEN** 成員嘗試刪除 ID 為 `T001`
- **THEN** API 回傳 403

#### Scenario: 刪除自訂標籤
- **WHEN** 成員刪除自己的自訂標籤
- **THEN** `tag_library` 該列移除，並透過 `remove_tag_from_templates(p_member_id, p_tag_id)` RPC 從所有 schedule blocks 的 `block_tags` 中移除該標籤

---

### Requirement: 時間區段儲存（原子替換）
`POST /api/schedule/template` SHALL 接受 `{ blocks: ScheduleBlock[], isPublic: boolean }` 並透過 `replace_schedule_template(p_member_id, p_is_public, p_blocks)` RPC 原子操作（DELETE + INSERT）替換成員的所有時間區段。每個 `block` 包含 `start_time`、`end_time`、`block_tags` (JSONB array)、`note`。

#### Scenario: 儲存模板
- **WHEN** 成員提交 5 個時間區段
- **THEN** RPC 內 transaction 先刪除該成員所有舊列、再 INSERT 5 筆新列；失敗則 rollback

#### Scenario: 跨午夜區段
- **WHEN** 成員提交 `start_time = "22:00"`、`end_time = "06:00"`
- **THEN** 系統儲存原值；前端時間軸視圖顯示「翌日」標記

---

### Requirement: 公開 / 私密切換
每個成員的模板 SHALL 有單一 `is_public` 旗標（不是逐 block 設定）。公開時其他成員可在群組行程頁瀏覽；私密時僅成員本人可見。

#### Scenario: 切換公開
- **WHEN** 成員儲存模板時 `isPublic = true`
- **THEN** 該成員所有 `schedule_template` 列 `is_public = true`

#### Scenario: 群組行程瀏覽
- **WHEN** 任一成員呼叫 `GET /api/schedule/public`
- **THEN** 回傳所有 `is_public = true` 成員的模板（依姓名分組）

---

### Requirement: 列表與時間軸雙視圖
`/schedule` 頁面 SHALL 提供「列表」與「時間軸」切換：

- **列表**：依 `start_time` 升序顯示時間區段，跨午夜段標示「翌日」
- **時間軸（TimelineView）**：比例時軸 + 重疊分欄 + 現在時刻紅線；唯讀

#### Scenario: 切到時間軸
- **WHEN** 成員點時間軸切換鈕
- **THEN** 顯示比例化時軸，重疊區段並排，紅線標示現在時刻

#### Scenario: 列表跨午夜標示
- **WHEN** 列表顯示 `22:00 - 06:00` 區段
- **THEN** 區段標示「翌日 06:00」字樣

---

### Requirement: 拖拉互動（@dnd-kit）
列表視圖 SHALL 支援以下拖拉操作（透過 `@dnd-kit/core` + `@dnd-kit/sortable`）：

- 標籤庫 → 區段：在區段內新增標籤
- 區段間移動：標籤從 A 區段移至 B 區段
- 區段內排序：調整同區段內標籤順序
- 拖回左欄：從區段移除標籤

#### Scenario: 標籤拖入區段
- **WHEN** 成員從標籤庫拖一個標籤到「09:00–10:00」區段
- **THEN** 該區段 `block_tags` 新增該標籤物件

#### Scenario: 拖回左欄
- **WHEN** 成員從區段拖一個標籤回左側標籤庫
- **THEN** 該標籤從區段 `block_tags` 移除

---

## Data Model

### tag_library

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | TEXT PK | T001–T014（系統）/ U{memberId}_xxx（自訂） |
| member_id | TEXT | NULL = 系統標籤 |
| tag_name | TEXT | |
| color | TEXT | hex 色碼 |
| emoji | TEXT | 選填 |
| is_system | BOOLEAN | TRUE 不可刪除 |

### schedule_template

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| member_id | TEXT FK | |
| start_time | TEXT | HH:MM |
| end_time | TEXT | HH:MM（< start_time 表跨午夜） |
| block_tags | JSONB | `[{id, name, color, emoji}]` |
| note | TEXT | |
| is_public | BOOLEAN | |
| updated_at | TIMESTAMPTZ | |

## RPC Functions

- `replace_schedule_template(p_member_id, p_is_public, p_blocks)`：原子 DELETE + INSERT
- `remove_tag_from_templates(p_member_id, p_tag_id)`：以 `jsonb_array_elements` 從所有 blocks 的 `block_tags` 移除該標籤

## Rate Limiting

`POST /api/schedule/tag` per-IP 限流 30 次/分鐘。

## Notes / Limitations

- 「複製成員模板」功能（`POST /api/schedule/clone`）尚未實作，目前無 API 與 UI
- `block_tags` 為 JSONB 物件陣列，取代早期 `tag_id`/`tag_name` 雙欄設計
