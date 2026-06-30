## Context

打卡提交目前對 8 項任務各自獨立處理：`tasks` 是長度 8 的 boolean 陣列，由 `CheckInSubmitSchema`（`lib/validation.ts`）做形狀驗證，再交由 `app/api/checkin/submit/route.ts` 的 POST／PATCH 寫入。兩條路徑都呼叫同一個 `parseBody(request, CheckInSubmitSchema)` 解析。系統沒有任何跨任務的前置條件。

本變更要新增一條跨任務約束：勾「破曉打拳」（`tasks[1]`）就必須勾「早睡早起／子時入睡」（`tasks[0]`）。語意已確認——同一筆打卡內判定、早睡只要勾選即算（1 分或 0.5 分皆可）、後端拒絕加前端提示。

## Goals / Non-Goals

**Goals:**
- 在 POST 與 PATCH 兩條路徑一致地強制「打拳須先早睡」。
- 後端為唯一可信防線，回 400 與明確中文訊息；前端額外提供即時防呆。
- 不影響既有計分、`punch_streak`、成就邏輯與資料庫 schema。

**Non-Goals:**
- 不做跨日驗證（不檢查前一日是否早睡）。
- 不回溯修正歷史紀錄。
- 不自動代勾任務或改變 task 0 兩段式按鈕互動（留待後續）。

## Decisions

### 決策 1：以 `CheckInSubmitSchema.refine()` 作為主驗證點
在 schema 末端加跨欄位 `.refine(d => !d.tasks[1] || d.tasks[0], { message, path: ['tasks'] })`。

- **理由**：POST 與 PATCH 都經過 `parseBody(CheckInSubmitSchema)`，在 schema 加一次即同時覆蓋兩條路徑，零重複、不易漏。失敗時 `parseBody` 既有機制回傳首個 issue message + 400，前端 `handleSubmit` 的 `if (!json.ok) toast.error(json.msg)` 會自動顯示。
- **替代方案**：在 route.ts 的 POST 與 PATCH 各自手寫 if 檢查。否決——邏輯重複兩份、未來容易只改一處而漏另一處。

### 決策 2：前端 `handleSubmit` 送出前先攔截
在 `app/(main)/checkin/page.tsx` 的 `handleSubmit` 開頭加 `if (checked[1] && !checked[0]) { toast.error(...); return }`。

- **理由**：即時回饋、省下一次無謂往返；文案與後端一致。
- **替代方案**：只靠後端。否決——使用者要等請求回來才知錯，體驗較差；但後端仍是唯一可信防線，前端僅為輔助。

### 決策 3：早睡只要勾選即算滿足
條件用 `tasks[0]` 布林值，不細分 `early_sleep_half`。

- **理由**：已與使用者確認，11 點前（1 分）與 12 點前（0.5 分）都算完成子時入睡。

## Risks / Trade-offs

- [`.refine()` 使 `CheckInSubmitSchema` 型別由 `ZodObject` 變為 `ZodEffects`] → 確認無任何處對它做 `.extend()`／`.partial()`／`.merge()`；經查 `CheckInSubmitSchema` 僅在 `route.ts` 經 `parseBody` 使用，`parsed.data` 解構不受影響。以 `npx tsc --noEmit` 驗證。
- [前端與後端文案各寫一份，可能日後不同步] → 兩處皆採同一字串；非阻斷性風險，影響僅為提示文字。
- [既有未早睡卻已打拳的歷史紀錄] → 不回溯；規則僅約束新提交與修改，符合 Non-Goals。

## Migration Plan

- 純驗證邏輯新增，無資料遷移、無 schema 變更。
- 部署即生效，僅影響新提交／修改。
- 回滾：移除 `.refine()` 與前端攔截即可，無殘留狀態。

## Open Questions

- 無。語意三項決策皆已與使用者確認。
