## 1. 推薦純函式（lib/scoring.ts）

- [x] 1.1 新增 `recommendLevel(rate: number | null, maxScore: number)` → `{ level: string | null }`
- [x] 1.2 `maxScore<=0` 或 `rate==null` → `level: null`（豁免/無資料，避免 rate=0 誤判）
- [x] 1.3 `rate>=80 → 黃金`、`>=70 → 白銀`、否則 `青銅`（以 LEVEL_THRESHOLDS 換算比對）
- [x] 1.4 邊界防護：rate 恰好等於門檻（80/70/60）落在正確階

## 2. Dashboard route 回推薦（app/api/stats/dashboard/route.ts）

- [x] 2.1 推導「上月」年月字串（當前月減一月，日期運算、正確跨年）
- [x] 2.2 撈上月 `monthly_summary`（rate、max_score）；無列則視為無資料
- [x] 2.3 呼叫 `recommendLevel` → 回傳加 `levelRecommendation: { level, lastMonthRate } | null`
- [x] 2.4 確認既有回傳欄位不變

## 3. 前端選階區標註（app/(main)/dashboard/page.tsx）

- [x] 3.1 更新 DashboardData 型別加 `levelRecommendation`
- [x] 3.2 下月階梯選擇區（L303–315）：在建議階按鈕標「⭐建議」
- [x] 3.3 顯情境成長文案：升階鼓勵 / 維持肯定 / 青銅給方向（離白銀差 X%）/ 降階婉轉（不用「退步」）
- [x] 3.4 三階按鈕維持全部可選（推薦是引導非限制）
- [x] 3.5 無推薦（null）→ 顯「首月自由選」；已選下月階梯者推薦淡化仍顯

## 4. 驗證

- [x] 4.1 `npx tsc --noEmit` + `npm run lint` 通過
- [x] 4.2 `openspec validate add-level-recommendation --strict` 通過
- [x] 4.3 單元驗證 `recommendLevel`：80/70/60 門檻邊界、豁免(maxScore=0)→null、無資料→null、跨年月字串
- [x] 4.4 以 2026-07 實測 22 人回歸：結果應為 1 黃金 / 5 白銀 / 16 青銅（含 3 升階、5 降階方向正確）
- [ ] 4.5 手動（部署後）：25 日後選階區顯建議標記 + 文案；三階仍可選；新進/豁免顯「首月自由選」
