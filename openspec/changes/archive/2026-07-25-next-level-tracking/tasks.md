## 1. 資料庫遷移

- [x] 1.1 建立 `supabase/migrations/20260502_chose_next_level.sql`：`ALTER TABLE monthly_summary ADD COLUMN chose_next_level BOOLEAN NOT NULL DEFAULT FALSE`
- [x] 1.2 同步更新 `supabase/schema.sql` 的 `monthly_summary` 表定義
- [x] 1.3 在 Supabase SQL Editor 執行遷移，確認既有列填預設 false

## 2. Settlement 邏輯擴充

- [x] 2.1 修改 `lib/settlement.ts` `runSettlement`：對所有 `status != '停用'` 成員 iterate（含新進豁免）
- [x] 2.2 新進豁免成員寫 stub 列（`max_score = 0`、其他統計值為 0/false、`chose_next_level = (next_level IS NOT NULL)`）
- [x] 2.3 next_level 套用 + 清空 SHALL 涵蓋所有非停用成員（包含豁免）
- [x] 2.4 將 `chose_next_level = (next_level IS NOT NULL)` 加入 monthly_summary upsert 欄位
- [x] 2.5 確認月度成就觸發邏輯不受影響（豁免成員仍不觸發）

## 3. API 新增

- [x] 3.1 建立 `app/api/admin/unselected-next-level/route.ts`（GET：依 yearMonth 查 `chose_next_level = false`）
- [x] 3.2 yearMonth 缺省為「最近一個已月結月份」（從 `monthly_summary` 取 max(year_month)）
- [x] 3.3 未月結月份回傳 `{ ok: true, rows: [], notSettled: true }`
- [x] 3.4 建立 `app/api/admin/members/batch-deactivate/route.ts`（POST：循序處理 + succeeded/failed 結構）
- [x] 3.5 批次 API 對 `memberIds = []` 回 400

## 4. 型別與驗證

- [x] 4.1 在 `types/index.ts` 新增 `UnselectedNextLevelRow` 介面
- [x] 4.2 在 `lib/validation.ts` 新增 batch-deactivate 的 Zod schema（`z.array(z.string()).min(1)`）

## 5. 前端 UI

- [x] 5.1 建立 `components/admin/UnselectedNextLevelList.tsx` 元件（列表 + checkbox + 單筆/批次停用）
- [x] 5.2 在 `app/(main)/admin/page.tsx` 罰款 Tab 加入此元件，傳入當前選擇的 yearMonth
- [x] 5.3 名單為空顯示「本月所有成員均已選擇下月階梯」
- [x] 5.4 歷史 migration 前的月份顯示「快照僅供參考」提示
- [x] 5.5 批次停用前彈出 `Confirmation` 對話框（沿用既有 confirm 模式）
- [x] 5.6 操作成功後從名單移除該成員（樂觀更新或重新 fetch）

## 6. OpenSpec specs 同步

- [ ] 6.1 將本 change 對 `monthly-settlement` 的 delta archive 至 `openspec/specs/monthly-settlement/spec.md`（透過 `openspec archive`）
- [ ] 6.2 將 `admin-console` 的 delta archive 至對應 spec
- [ ] 6.3 確認 `openspec validate --all` 通過

## 7. 驗收

- [x] 7.1 執行 `npx tsc --noEmit` 確認零型別錯誤
- [ ] 7.2 在 staging 環境手動觸發月結，確認 `monthly_summary.chose_next_level` 正確 snapshot
- [ ] 7.3 測試新進豁免成員：5/29 加入，6/1 月結後 `monthly_summary` 該列存在且 `chose_next_level` 反映 next_level 設定
- [ ] 7.4 測試 API：`GET /api/admin/unselected-next-level?yearMonth=2026-05` 正確回傳名單
- [ ] 7.5 測試 UI：罰款月份切換時「未選下月階梯」區塊同步切換
- [ ] 7.6 測試批次停用：勾選 3 人 → 批次停用 → DB `status` 全變更 + 名單移除
- [ ] 7.7 測試非管理員無法呼叫新 API → 403
