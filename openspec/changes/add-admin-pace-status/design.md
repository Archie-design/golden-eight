## Context

管理員後台「全員進度」（`app/(main)/admin/page.tsx`，資料來自 `app/api/stats/progress/route.ts`）狀態欄目前顯示二元 `passing ? 達標 : 未達標`，`passing = 月率 ≥ 門檻`。月率分母是整月（`calcMonthStats` 的 `maxScore = fullMonthDays × 8`），所以月中對每個人都是 false → 全員顯示「❌ 未達標」，無法分辨誰真的落隊。

探索確認（見 explore 對話與模擬）：以截圖 14 人套二維模型，得 6 安全 / 3 溫水 / 5 要救，把「數學必然的紅」和「真落隊」清楚分開，且「溫水區」（pace 看似 OK、月底卻要被罰）正是單軸抓不到、二維才逮得住的隱性落隊者。

現成積木：
- `expectedCheckinDays(member, ym, refDate)` — 到 refDate 的應打天數（pace 分母基礎）。
- `calcMonthStats` — 已回 `totalScore`、`maxScore`、`rate`、`passing`。
- `LEVEL_THRESHOLDS` — 各階級門檻。
- progress route 已有 `isCurrentMonth` 旗標；前端已有 `useSettled`（歷史月看月結）切換。

## Goals / Non-Goals

**Goals:**
- 狀態欄從二元改為二維四象限（🔴🟠🟡✅），只在本月現時視圖。
- pace（回顧）+ 月底預估（前瞻）兩軸，各以純函式計算。
- 豁免成員顯「本月新進」；歷史月維持月結顯示不變。
- 月率/pace/預估保留為輔助數字。

**Non-Goals:**
- 不做個人任務層級下鑽（誰卡在哪一項）——另開一案（explore 決議）。
- 不改計分、月結、罰款、export、leaderboard。
- 不改「照速度外推」的模型複雜度（線性夠用，近 7 天加權另議）。
- 不動歷史月結資料。

## Decisions

### 決策 1：新增純函式 `calcPaceStatus`，計算集中一處
於 `lib/scoring.ts` 新增：
```
calcPaceStatus(member, stats, refDate, yearMonth) → {
  pace: number,        // 0-999，四捨五入的百分比
  projRate: number,    // 0-100，月底預估完成率
  quadrant: 'rescue' | 'lukewarm' | 'slow_start' | 'safe' | 'exempt'
}
```
- **pace** = `stats.totalScore / (expectedDays × 8 × threshold) × 100`，`expectedDays = expectedCheckinDays(member, ym, refDate)`。
- **projRate** = `(stats.totalScore / elapsedDays × monthDays) / stats.maxScore × 100`，`elapsedDays` 為本月已過天數（= refDate 距月初+1，但以成員 effective window 對齊，避免新進被稀釋——見決策 3）。
- **quadrant**：`maxScore === 0` → `exempt`；否則 `paceOk = pace >= 85`、`projOk = projRate >= threshold×100`，四象限對應。
- 純函式、吃已算好的 stats，不重查 DB，便於單測。

### 決策 2：只在 progress route 的本月路徑計算
progress route 對每列：`isCurrentMonth` 為真 → 呼叫 `calcPaceStatus`，回 `pace/projRate/paceStatus`；為假 → 這三欄回 null（歷史月不需要）。前端據 `isCurrentMonth`／`useSettled` 決定讀 quadrant 或 settledPassing。

### 決策 3：pace 與預估的「天數」對齊個人 effective window
分母（應打天數、已過天數）MUST 用 `expectedCheckinDays` 的個人起算（effective_start_date 或月初），與 `calcMonthStats` 的 `maxScore` 對齊——月中新進者不應被「整月天數」稀釋。`elapsedDays` 取 `expectedCheckinDays(member, ym, refDate)`（即到今日、從個人起算的應打天數），與 pace 分母同源，一致。

### 決策 4：門檻參數集中、可調
pace 二分點 **85**、四象限門檻，定義為 `lib/constants.ts` 常數（如 `PACE_OK_THRESHOLD = 0.85`），避免散落 magic number，日後可調（explore 已試 95/85/65，選定 85 為 pace 二分點）。

### 決策 5：前端狀態欄呈現
- 主視覺：quadrant 的 emoji + 標籤 + 分色（紅/橘/黃/綠）。
- 輔助：同格或 tooltip 顯示 `月率 X% ・ pace Y% ・ 月底預估 Z%`。
- 豁免：顯「本月新進，不參與計分」（沿用既有豁免文案）。
- 歷史月：`useSettled` 為真時完全走既有顯示，quadrant 相關 UI 不出現。

## Risks / Trade-offs

- **[線性外推對月初新進/請假者失真]** 剛加入或中間長假者，線性外推會高估或低估月底。→ 分母已對齊個人 window（決策 3）緩解「新進被稀釋」；長假失真列為已知限制，Non-Goal 不處理，之後可換近 7 天加權。
- **[quadrant 邊界抖動]** 接近門檻者可能每天在象限間跳。→ 本功能是輔助判斷、非自動處置，抖動可接受；不加遲滯（hysteresis）以免複雜化。
- **[門檻選擇影響紅名單長度]** 85% 二分點是體感值。→ 常數化（決策 4）便於上線後依實際觀感調整。
- **[與月率並存造成混淆]** 三個百分比（月率/pace/預估）同列可能雜。→ quadrant 為主、百分比為輔（小字或 tooltip），主視覺單一。
- **[歷史月誤算]** 若不擋 isCurrentMonth 會對已結束月算無意義 pace。→ spec + route 明確只在本月算。

## Migration Plan

- 純衍生欄位 + 前端呈現：`lib/scoring.ts` 新增 `calcPaceStatus`、`lib/constants.ts` 新增門檻常數、`progress/route.ts` 本月路徑多回三欄、`admin/page.tsx` 狀態欄改讀。無 schema、無資料遷移。
- 回滾：移除三欄與前端分支即可，狀態欄還原為 `passing` 二元。
- 驗證：以截圖資料對照 explore 模擬（6 安全/3 溫水/5 要救）；單測 `calcPaceStatus` 四象限 + 豁免 + 邊界。

## Open Questions

- 是否要在表頭加「只看 🔴🟠」的篩選（把該關心的人濾出）——本次先只改狀態欄語意，篩選視需求再加（可併入下鑽那案）。
- 月底預估要不要顯示「差 N 分就安全」——能算則可加，非本次核心，先給百分比。
- 「溫水」的命名要不要更中性（如「需注意」）——UI 文案，實作時可再定。
