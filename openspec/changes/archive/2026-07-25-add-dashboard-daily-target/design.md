## Context

學員儀表板（`app/(main)/dashboard/page.tsx`，資料來自 `app/api/stats/dashboard/route.ts`）已顯示累計得分、達成率、距目標差（`stats.remaining`）、目標分（`stats.targetScore`）。這些都是回顧數字，缺一個「距目標差 ÷ 剩餘天數 = 日均需分」的前瞻提醒。

確認事實：
- dashboard route 已回 `stats.remaining`（距目標差）、`stats.targetScore`、`stats.totalScore`、`isCurrentMonth`。
- `calcMonthStats` 的 `remaining = max(0, targetScore − totalScore)`，已是「距目標差」正值。
- 有 `getTodayTaipei` / `getMonthEnd`；剩餘天數可由今天 day 與月底 day 直接算。
- 本功能與 admin 的 pace-status 同源思路（前瞻），但受眾是學員自己、呈現更聚焦「我每天要拿幾分」。

模擬驗證（柯啟鴻 青銅、剩 76.5、7/18）：剩餘天數 14（含今天）→ 每天需 5.5 分（可達成）。黃名禎剩 36 → 2.6 分；高珮綺剩 94.5 → 6.8 分。皆合理。

## Goals / Non-Goals

**Goals:**
- 把「距目標差」換算為「日均需分」，一句話提醒學員接下來每天要拿幾分。
- 三情境：已達標 / 一般（≤8）/ 已難達標（>8）。
- 僅本月現時視圖；豁免與歷史月不顯示。

**Non-Goals:**
- 不做「與近 7 天均分比較」（AskUser 選了「一句話」，非比較版）。
- 不改計分、月結、schema。
- 不做通知推播（純儀表板呈現）。
- 不處理「今天已打卡則分母改明天起」（AskUser 選含今天，簡單一致）。

## Decisions

### 決策 1：剩餘天數含今天
`daysLeft = 月底day − 今天day + 1`。含今天 → 月底當天為 1，不除零；語意「包含今天，還有幾天可拼」符合學員直覺。分母簡單、不需判斷今天是否已打卡（Non-Goal）。

### 決策 2：日均需分與情境判定
```
remaining = stats.remaining            // 已是 max(0, target−total)
daysLeft  = getMonthEnd day − today day + 1   // ≥1
dailyNeeded = remaining / daysLeft

情境：
  remaining <= 0        → 'achieved'    已達標
  dailyNeeded > 8       → 'unreachable' 已難達標（超單日上限 8）
  else                  → 'on_track'    一般，顯示 dailyNeeded
```
- `> 8` 即數學上不可能（單日滿分 8）。剩 1 天需 9 分也會落此類，語意一致（確實達不到）。
- dailyNeeded 顯示四捨五入到小數 1 位（如 5.5）。

### 決策 3：僅本月算，歷史月/豁免回 null
route 在 `isCurrentMonth === true` 且非豁免（`maxScore > 0`）時計算 `daysLeft`、`dailyNeeded`、`targetStatus`；否則回 null。前端據此決定是否顯示提醒。豁免沿用既有 exempted 判斷（`maxScore === 0`）。

### 決策 4：前端一句話呈現
於「距目標差」數字附近（同卡片內）加一行提醒文字，依 targetStatus：
- achieved → 「✅ 已達標，繼續保持！」（綠）
- on_track → 「還有 {daysLeft} 天，平均每天需 {dailyNeeded} 分達標 💪」
- unreachable → 「本月已難達標，下月再拼！」（灰）
不新增卡片、不改版面主結構，最小侵入。

## Risks / Trade-offs

- **[已達標者 remaining=0，日均無意義]** → achieved 情境明確不顯示日均，改顯鼓勵語。
- **[「已難達標」措辭打擊士氣]** → 用「下月再拼」正向收尾，非「你失敗了」；且僅在數學上真的不可能（>8）才顯示。
- **[含今天 vs 不含今天的準度]** → 含今天略保守（若今天已打卡，實際壓力更小），但簡單且不會低估壓力，可接受；Non-Goal 不細分。
- **[月率 vs 日均並存]** → 日均是新增的前瞻句，與既有回顧數字互補，不衝突。
- **[跨階級門檻]** → remaining/targetScore 已依成員階級算（calcMonthStats 用 member.level 門檻），日均自動反映各階級。

## Migration Plan

- 純衍生欄位 + 前端一句話：`dashboard/route.ts` 本月多回 `daysLeft`/`dailyNeeded`/`targetStatus`；`dashboard/page.tsx` 加提醒行。無 schema、無資料遷移。
- 回滾：移除三欄與前端行即可。
- 驗證：以柯啟鴻/黃名禎/高珮綺數據對照模擬；單測情境（達標/一般/難達/月底除零邊界）。

## Open Questions

- 「已難達標」要不要改顯「保底目標」（如降階或部分達成）——本次不做，先明確三情境。
- 日均需分要不要標「你近 7 天平均 X 分」對比——AskUser 選一句話版，留待反饋再議。
