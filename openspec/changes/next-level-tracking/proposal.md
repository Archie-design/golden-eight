## Why

每月 25 號之後成員可選擇下月階梯（共 5–6 天）。實務上，沒有選擇下月階梯通常代表成員不想繼續參與；管理員在月結統計罰款時，需要把這些人從群組中請離以維持群組執行頻率。

但目前的設計缺一塊：`members.next_level` 在月結瞬間會被套用至 `level` 並清空，導致月結後無法回查「誰沒選下月階梯」。需要為月結加入快照機制，並在管理後台提供查詢與批次處理 UI。

## What Changes

- **修改** `monthly_summary` 表：新增 `chose_next_level BOOLEAN NOT NULL DEFAULT FALSE` 欄位（snapshot：月結套用前 `members.next_level` 是否非 NULL）
- **修改** `runSettlement` 邏輯：
  - 對所有 `status != '停用'` 成員（含新進豁免成員）寫入 `monthly_summary` 列，記錄 `chose_next_level`
  - 新進豁免成員寫入 stub 列（`max_score = 0`、`total_score = 0`、`rate = 0`、`passing = false`、`penalty = 0`），僅用於追蹤 `chose_next_level`
  - 同時為所有 `status != '停用'` 成員執行 next_level 套用與清空（含新進豁免成員）
- **新增** API `GET /api/admin/unselected-next-level?yearMonth=YYYY-MM`：列出指定月份未選下月階梯的成員（依 `monthly_summary.chose_next_level = false` 查詢）
- **新增** API `POST /api/admin/members/batch-deactivate`：批次停用成員（接受 `{ memberIds: string[] }`）
- **修改** 管理後台「罰款總結」Tab：新增「未選下月階梯」區塊，與罰款月份選擇器連動；提供每人一鍵停用 + 全選批次停用
- **修改** OpenSpec spec/monthly-settlement：補上 `chose_next_level` 快照與 stub 列邏輯
- **修改** OpenSpec spec/admin-console：「罰款總結」Tab 區塊與新 API

## Capabilities

### New Capabilities

（無 — 本次為既有 capability 的擴充）

### Modified Capabilities

- `monthly-settlement`: 月結 SHALL 為所有 `status != '停用'` 成員寫入 `monthly_summary.chose_next_level` 快照，並涵蓋新進豁免成員的 stub 列；next_level 套用與清空 SHALL 一併套用至所有非停用成員
- `admin-console`: 罰款總結 Tab 新增「未選下月階梯」區塊；新增批次停用 API

## Impact

- **資料庫**：`monthly_summary` 加 `chose_next_level` 欄位（migration `supabase/migrations/20260502_chose_next_level.sql`）
- **後端**：`lib/settlement.ts`（runSettlement）、`app/api/admin/unselected-next-level/route.ts`（新增）、`app/api/admin/members/batch-deactivate/route.ts`（新增）
- **前端**：`app/(main)/admin/page.tsx` 罰款 Tab 加區塊、可能新增子元件 `components/admin/UnselectedNextLevelList.tsx`
- **OpenSpec specs**：`specs/monthly-settlement/spec.md`、`specs/admin-console/spec.md` 加入 delta
- **歷史月份**：既有 `monthly_summary` 列 `chose_next_level` 預設 false。對歷史資料無法精確回填（next_level 已清空），但對未來月份正確；提供 backfill 選項作為一次性處理
