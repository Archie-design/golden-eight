## Why

每月 25 日後學員可選擇下月階梯（黃金/白銀/青銅），但目前是「憑感覺選」——沒有依據，選錯階可能整月被罰（門檻越高罰金越少的結構讓選擇更不直覺：黃金 80% 罰 200、白銀 70% 罰 300、青銅 60% 罰 400）。用學員上月的實際完成率，給一個「你做得到的那一階」的建議，幫學員做出循序成長、又不致被罰的選擇。

## What Changes

- **新增「推薦下月階梯」**：依上月完成率對照三階門檻，推薦「能穩穩達標的最高階」。
  - 上月 ≥80% → 建議黃金；70–79% → 建議白銀；<70% → 建議青銅。
  - 無上月資料（新進／剝選／豁免）→ 不推薦，顯「首月自由選」。
- **呈現於既有下月階梯選擇區**（dashboard，25 日後顯示）：在建議的那一階標「⭐建議」，**三階按鈕仍全部可選**——推薦是引導，非限制。
- **附成長文案**（依情境）：升階「你上月 92%，可挑戰黃金」、維持「穩住白銀」、青銅「離白銀差 X%，穩住這月、下月衝」、降階婉轉「先把基礎打穩」（不說「退步」）。
- **不展開各階預估**：只標建議階 + 一句理由，不堆疊「每階選了會怎樣」的數字。

核心哲學：**「站穩你做得到的那一階」**——照建議走的人下月極可能達標、不被罰，天然避開「精算最少罰金」的反教育誘因。不改計分、月結、階梯門檻、選擇機制本身。

## Capabilities

### New Capabilities
- `level-recommendation`: 依上月完成率推薦下月階梯的能力——涵蓋推薦規則（完成率對照門檻、取能達標的最高階）、無資料／豁免的排除、升階/維持/降階/青銅站穩的成長文案情境、以及「標建議但三階可選」的呈現契約。

### Modified Capabilities
<!-- 無：既有 next-level 選擇無 spec 涵蓋推薦語意；本次為新增衍生建議 + 呈現，不改選擇機制與計分。-->

## Impact

- **新增** `lib/scoring.ts` 純函式 `recommendLevel(lastMonthRate, lastMonthMaxScore)` → 回 `{ level | null, reason }`；`maxScore<=0`（豁免/無資料）回 null（沿用 pace-status 的豁免判斷）。
- **修改** `app/api/stats/dashboard/route.ts`：撈「上月」`monthly_summary`（rate、max_score），算推薦，於回傳加 `levelRecommendation: { level, reason } | null`。「上月」= 相對當前月的前一個已月結月（25 日選階時該月已結）。
- **修改** `app/(main)/dashboard/page.tsx`：下月階梯選擇區（L303–315）在建議階標「⭐建議」+ 顯理由文案；三階按鈕維持可選。
- **相依既有**：`LEVEL_THRESHOLDS`、`monthly_summary`（rate/max_score）、既有 next-level 選擇 UI 與 `setNextLevel`。
- 不影響 settlement、penalty、計分。
- 回滾：移除純函式 + 回傳欄位 + 前端標註即可，無資料遷移、無 schema、無 migration。
