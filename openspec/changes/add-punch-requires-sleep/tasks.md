## 1. 後端驗證（主防線）

- [x] 1.1 在 `lib/validation.ts` 的 `CheckInSubmitSchema` 末端加 `.refine(d => !d.tasks[1] || d.tasks[0], { message: '要打卡「破曉打拳」前，請先完成「早睡早起（子時入睡）」', path: ['tasks'] })`
- [x] 1.2 確認 `CheckInSubmitSchema` 無其他處做 `.extend()`／`.partial()`／`.merge()`（grep 確認僅 `route.ts` 經 `parseBody` 使用），確保 `ZodEffects` 變更不破壞型別

## 2. 前端防呆（體驗防線）

- [x] 2.1 在 `app/(main)/checkin/page.tsx` 的 `handleSubmit` 開頭、`setLoading(true)` 前加攔截：`if (checked[1] && !checked[0]) { toast.error('要打卡「破曉打拳」前，請先完成「早睡早起（子時入睡）」'); return }`

## 3. 驗證

- [x] 3.1 `npx tsc --noEmit` 通過（重點檢查 `route.ts` 對 `parsed.data` 解構不受 `ZodEffects` 影響）
- [x] 3.2 `npm run lint` 通過（0 errors；唯一 warning 為 page.tsx:468 既有 `<img>`，與本次改動無關）
- [ ] 3.3 端到端手動測試 POST：有打拳無早睡 → 400；早睡+打拳 → 成功；只早睡 → 成功；皆不勾 → 成功
- [ ] 3.4 端到端手動測試 PATCH：先建合法打卡，再改成「有打拳無早睡」→ 400 且原紀錄不變
- [ ] 3.5 前端測試：勾破曉打拳、不勾早睡早起，按送出 → 立即跳 toast、不發請求
