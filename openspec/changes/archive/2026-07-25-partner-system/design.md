## Context

黃金八套餐系統為 Next.js 16 App Router + Supabase PostgreSQL 架構，所有 DB 存取在 server-side（service_role 繞過 RLS）。現有系統無任何社交互動功能，成員資訊完全獨立。夥伴機制需在不影響現有打卡、排行榜、成就流程的前提下疊加。

現有相關基礎設施：
- `members` 表：成員基本資料（id, name, level, line_user_id, effective_start_date）
- `checkin_records` 表：每日打卡記錄（tasks BOOLEAN[8], punch_streak）
- `achievements` 表：成就解鎖記錄（UNIQUE(member_id, code)）
- `lib/scoring.ts`：純函式計算月度統計，可複用
- `lib/api-helper.ts`：`getCurrentMember()`、`getTodayTaipei()` 等工具函式

## Goals / Non-Goals

**Goals:**
- 雙向夥伴邀請，雙方均需確認才建立關係
- 夥伴清單 API 單次查詢回傳完整快照（避免 N+1）
- 鼓勵行為以 DB UNIQUE 約束防止重複，無需應用層 lock
- 夥伴成就觸發整合進現有打卡提交流程（不重複觸發全量成就計算）
- 9 個新成就不破壞現有 44 個成就的計算邏輯

**Non-Goals:**
- 即時通知（LINE Push 通知為 TODO，本次不實作）
- 夥伴間私訊功能
- 群組概念（超過 2 人的社交單位）
- 歷史鼓勵紀錄查詢

## Decisions

### 1. 夥伴關係儲存：單向記錄 vs 雙向記錄

**決策**：使用單向記錄（`partner_requests`），查詢時以 OR 條件取「我是 requester 或 target 且 status=accepted」。

**理由**：避免每次建立關係都插入兩筆對稱記錄；解除關係只需刪除一筆。JOIN 查詢可透過 SQL OR 處理，Supabase 客戶端以兩次 `.in()` 查詢合併亦可行。

**替代方案**：雙向插入（兩筆）— 查詢較簡單，但 insert/delete 需原子化操作，增加複雜度。

---

### 2. 夥伴快照查詢：即時計算 vs 快取

**決策**：GET `/api/partners` 即時從 `checkin_records` 計算當日狀態與本月統計，不另建快取表。

**理由**：夥伴上限 10 人，批次查詢代價低。現有 `calcMonthStats()` 為純函式可直接複用。快取表需額外同步邏輯，維護成本不值得。

**替代方案**：在 `monthly_summary` 加 denormalized 欄位 — 需每次打卡後觸發更新，與現有月結流程衝突。

---

### 3. 競爭/同步成就觸發時機：打卡提交時 vs 定時任務

**決策**：在 `POST /api/checkin/submit` 提交成功後，非同步查詢夥伴資料計算競爭/同步類成就。

**理由**：與現有成就觸發模式一致（打卡提交後立即解鎖），使用者可即時看到成就。

**替代方案**：cron job 每日結算 — 延遲感強，實作複雜度不降反升。

---

### 4. `calcPartnerSyncStreak` 函式設計

新增純函式至 `lib/scoring.ts`：

```ts
function calcPartnerSyncStreak(
  myDates: Set<string>,
  partnerDates: Set<string>,
  endDate: string,
  windowDays: number
): number
```

從 `endDate` 往回算最多 `windowDays` 天，計算連續同日打卡天數。純函式，可單元測試。

---

### 5. 夥伴成就不重走全量成就計算

打卡提交後，夥伴成就觸發邏輯獨立於現有 `calcNewAchievementsFromAggregates`。避免因夥伴數據查詢拖慢現有打卡回應時間，以獨立查詢區塊處理。

## Risks / Trade-offs

- **[風險] 夥伴清單 API 效能** → 最多 10 位夥伴 × 本月打卡記錄，單月最多 ~310 筆；批次 `.in()` 查詢可控。若後期需優化，可加 Redis cache 層。
- **[風險] 打卡提交時間增加** → 夥伴成就查詢新增 2–3 次 DB 查詢；可接受，不影響主流程回應（成就解鎖為附加操作）。
- **[Trade-off] 單向關係記錄** → 查詢時需 OR 條件，部分 Supabase SDK 方法需拆成兩次查詢合併，稍增查詢複雜度，換取 DML 簡單性。
- **[風險] 09 個新成就圖示重複** → `Handshake` 圖示目前 ICON_MAP 不存在，需新增至 `lib/icons.tsx`。

## Migration Plan

1. 執行 `supabase/migrations/20260430_partners.sql`（建立 `partner_requests`、`encouragements` 兩表）
2. 同步更新 `supabase/schema.sql`
3. 部署新 API routes（向後相容，現有 API 不受影響）
4. 部署前端頁面與 Navbar 修改
5. 無需資料遷移（兩張新表從空開始）

**Rollback**：DROP 兩張新表，還原 Navbar / Dashboard / checkin submit 的修改。

## Open Questions

- `Handshake` 圖示是否存在於目前安裝的 lucide-react 版本？（需驗證，若無則改用 `Link` 或 `Handshake` 的替代）
- `PARTNER_BEAT_RATE` / `PARTNER_BEAT_STREAK` 成就：比較基準是「任一」夥伴還是「所有」夥伴？（規格文件指定「任一」，維持此設計）
