## Context

目前 `members.next_level` 在 cron 月結（每月 1 日 13:00 台北）瞬間被套用至 `members.level` 並清空。月結後管理員處理罰款時，無從得知「誰沒選下月階梯」這項關鍵資訊。

業務脈絡：選擇下月階梯被視為「願意繼續參與下月」的表態，未選擇者視為流失意願。為維持群組執行頻率，管理員需在月結後將這些成員停用，他們可在日後重新加入。

現有相關設計：
- `runSettlement(db, yearMonth, today)` 為月結唯一入口，cron 與 admin 共用
- `monthly_summary` 表（UNIQUE(member_id, year_month)）已記錄月度結算結果
- 新進豁免成員（`effective_start_date > monthEnd`）目前 settlement 直接 skip，不寫 `monthly_summary` 列
- Admin 後台「罰款總結」Tab 已有 `GET /api/admin/penalty?yearMonth` API，回傳未通關成員列表

## Goals / Non-Goals

**Goals:**
- 月結時 snapshot 每位成員的「是否選擇下月階梯」狀態至 `monthly_summary`
- 提供管理後台 UI 列出指定月份未選成員，與罰款月份選擇器連動
- 提供逐筆與批次「停用」操作，簡化管理流程
- 新進豁免成員（首月）也納入快照，避免名單漏列

**Non-Goals:**
- 不主動通知成員「你還沒選下月階梯」
- 不改變現有 25 號邊界規則（仍只能 25 號之後選）
- 不新增「下月不參與」階梯選項；未選擇 = 不參與
- 不自動停用；停用 always 為管理員手動點擊觸發
- 不回填歷史 `chose_next_level`（資料已不可考）

## Decisions

### 1. 快照儲存位置：monthly_summary 加欄位 vs 新增表

**決策**：在 `monthly_summary` 加 `chose_next_level BOOLEAN NOT NULL DEFAULT FALSE`。

**理由**：本欄位只在月結瞬間記錄一次，與 `monthly_summary` 同生命週期。已有 UNIQUE(member_id, year_month) 索引，查詢與 join 簡單。新增表會增加 schema 與遷移成本而無收益。

**替代方案**：
- 新增 `next_level_audit` 記錄每次 next_level 變更 — 太過工程化、超過需求
- 寫 `members.last_chose_for_ym` — 隨時間累積髒資料，難以查歷史

---

### 2. 新進豁免成員的處理：stub 列 vs 跳過 + LEFT JOIN

**決策**：runSettlement 對所有 `status != '停用'` 成員寫 `monthly_summary` 列；新進豁免成員寫 stub 列（`max_score = 0`、其他統計值為 0/false）。

**理由**：
- 統一查詢路徑，未選名單只需查 `monthly_summary.chose_next_level = false`，無 fallback 邏輯
- 新進成員的 next_level 也會被同月結清空（cron 統一處理），避免「next_level 永遠停在那裡」的尷尬狀態
- stub 列在前端排行榜、admin 進度等地方已有 `exempted` 處理路徑，不會誤顯示為 0% 通關

**替代方案**：
- LEFT JOIN + COALESCE 處理新進成員 — 查詢邏輯複雜化，且新進成員的 `members.next_level` 會跨多月停滯（settlement 不清）
- 完全排除新進成員 — 與使用者「不排除新進」決策不符

---

### 3. chose_next_level 的時點語意

**決策**：`monthly_summary.chose_next_level` 的語意為「該年月結算當下，成員是否已選下下月階梯」。

例：`year_month = 2026-05` 列的 `chose_next_level` 表示「6/1 月結瞬間，成員 next_level 是否非 NULL（即是否已選 6 月階梯）」。

**理由**：
- 月結 N/1 時「下月」即為 N 月（剛開始）；snapshot 對應「是否願意參與 N 月」
- 查詢「沒選 N 月階梯」= 查 `monthly_summary` where `year_month = (N-1)月` AND `chose_next_level = false`
- 與使用者敘述「7/1 統計 6 月罰款時要知道誰沒選 7 月階梯」一致

**替代方案**：將 `chose_next_level` 記在「N 月那筆 row」 — 概念較直覺但 N 月 row 在 N+1/1 才寫入，與「6/25–6/30 選擇 7 月階梯」timing 不同步，反而困惑。

---

### 4. UI 區塊位置

**決策**：「罰款總結」Tab 加「未選下月階梯」區塊，與既有月份選擇器連動。

**理由**：
- 管理員處理流程：點月份 → 同時看到罰款 + 未選名單 → 一頁完成
- 使用者明確選擇此方案
- 不額外新增 Tab 維持後台簡潔

---

### 5. 批次停用 API 設計

**決策**：新增 `POST /api/admin/members/batch-deactivate` 接受 `{ memberIds: string[] }`。

實作細節：
- 內部對每個 ID 呼叫既有 `PATCH /api/admin/members/[id]` 邏輯（`status = '停用'`）
- 回應 `{ ok, succeeded: string[], failed: { id, msg }[] }` 以便前端 toast 個別顯示
- 不採 transaction（部分失敗仍允許其他成功）；失敗多半因成員不存在或已停用，無需 rollback

**替代方案**：在前端逐筆呼叫 PATCH — 網路成本高、UX 差（多次 toast 干擾）

---

### 6. 既有歷史月份的處理

**決策**：不回填歷史 `chose_next_level`。Migration 預設 false，UI 對「無 next_level snapshot 可信度」的歷史月份顯示提示文字「此月份月結前未啟用 snapshot 機制，名單僅供參考」。

**理由**：歷史 next_level 已清空，無從還原。回填只能依「目前 level 是否與 next_level 相符」推測，誤差大且無業務價值（用來請離開的時點已過）。

## Risks / Trade-offs

- **[風險] 既有 monthly_summary 列升級** → migration `ALTER TABLE ... ADD COLUMN chose_next_level BOOLEAN NOT NULL DEFAULT FALSE` 對現有列填 false，UI 提示「此為遷移預設值」即可
- **[風險] 新進豁免成員首次出現於 monthly_summary** → 排行榜、儀表板既有路徑均已支援 `exempted`/`maxScore=0` 邏輯，stub 列與既有路徑相容
- **[Trade-off] settlement 邏輯擴大覆蓋範圍** → 原本 skip 的成員也要寫 stub + 清 next_level，settlement 執行時間略增（線性多 N 筆 upsert）；以群組規模 ≤ 200 人，影響可忽略
- **[風險] 批次停用部分失敗** → API 回傳 succeeded/failed 兩組陣列；前端逐筆 toast，使用者可看到精確結果

## Migration Plan

1. 執行 `supabase/migrations/20260502_chose_next_level.sql`：`ALTER TABLE monthly_summary ADD COLUMN chose_next_level BOOLEAN NOT NULL DEFAULT FALSE`
2. 同步更新 `supabase/schema.sql`
3. 部署 `lib/settlement.ts` 修改（含 stub 列邏輯）
4. 部署新 API 與前端 UI
5. 下次月結（最近一次的 N+1/1 13:00）即生效，產生第一批 `chose_next_level` snapshot

**Rollback**：`ALTER TABLE monthly_summary DROP COLUMN chose_next_level`、還原 settlement 與 admin 修改。Migration 為 additive，rollback 不影響其他資料。

## Open Questions

- 已停用成員若想重新加入，目前 admin 流程未涵蓋（無「啟用」API）。本次不擴及，但若日後有大量回流情境需要補設計
- UI 上是否要顯示「該成員上次選擇下月階梯的月份」作為歷史背景？目前不實作，避免增加查詢成本；如使用者反饋有需要再加
