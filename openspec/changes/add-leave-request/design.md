## Context

請假直接改「計分分母」，而分母牽動整條計分鏈。盤點碼庫後，分母有**兩條動脈**：

```
① calcMonthStats.maxScore = fullMonthDays × 8   ← 達成率/達標/罰款/pace 分母
② expectedCheckinDays                            ← 破曉王/pace 應打卡天數
（另有工時扣分的「工作日」分母 working-days，屬另一套概念，本次不動）
```

呼叫 `calcMonthStats` 的有 13 處、`expectedCheckinDays`/`isDawnKing` 有 5 處。這些是純函式，現在不知道「請假」——**核心工程量在「讓每個分母呼叫點都扣掉請假日」**。

使用者決策（探索定調）：分子分母都移、學員自行請假（誠信）、**只能請今日或未來**、只能請本月/未來、事由後台清單下拉、UI 在打卡頁。

**「只能請今日/未來」大幅簡化設計**：請假永遠事先告知 → 請假日不會已有打卡分數 → 無「分子已算要退回」的競態、無過去日的追認漏洞。

## Goals / Non-Goals

**Goals:**
- `leave_records` 持久化請假（member+date+reason），一日一筆。
- 兩條分母動脈扣除請假日，13+ 呼叫點連帶正確。
- 後台事由清單 + 學員下拉選；打卡頁請假入口。
- 月結扣請假、可重現。
- 只能請今日/未來、本月/未來；可取消未來請假。

**Non-Goals:**
- 不改工時扣分的「工作日」分母（不同概念，請假不動工時分母——除非後續另議）。
- 不做管理員審核流程（誠信自行）。
- 不做請假上限（靠「只能請今日/未來」防濫用，不設月上限）。
- 不動已月結歷史月。
- 不改 8 項任務、罰金金額、門檻。

## Decisions

### 決策 1：leave_records 表，一日一筆
```
leave_records(
  id, member_id, date DATE, reason TEXT,
  created_at, UNIQUE(member_id, date)
)
```
- date 為邏輯日（與 checkin_records.date 同語意）。UNIQUE 保證一日一筆。reason 存事由文字（快照，避免事由清單日後改動影響歷史）。

### 決策 2：事由清單——小表 leave_reasons
- `leave_reasons(id, label, active, sort_order)`。後台 CRUD。學員請假時撈 active 清單下拉。存進 leave_records.reason 時存 label 文字快照。
- 替代：硬編碼常數。否決——使用者明確要「後台可設定」。

### 決策 3：分母函式加參數 `leaveDays`（該成員該月請假日集合）
- `calcMonthStats(member, records, refDate, leaveDates?)`：`fullMonthDays` 扣掉落在 [effectiveStart, monthEnd] 範圍內的請假日數 → `maxScore = (fullMonthDays − leaveCount) × 8`。records 已天然不含請假日得分（請假日不打卡；即使有打卡也不計，但「只能請今未來」使此情況幾乎不生）。
- `expectedCheckinDays(member, ym, refDate, leaveDates?)`：應打卡天數扣掉 ≤refDate 的請假日。
- 參數選填、預設空集合 → **既有呼叫不傳即行為不變**，降低回歸風險；逐一為呼叫點補傳。

### 決策 4：呼叫點統一撈請假日傳入
- 每個算分母的 route/lib：多一次查 `leave_records`（該成員或全員該月），組成 `Record<memberId, Set<date>>`，傳入分母函式。
- 抽 helper `fetchLeaveDates(db, memberIds, ym) → Record<id, Set<date>>` 於 `lib/leave.ts`，各呼叫點複用，避免重複查詢邏輯。

### 決策 5：只能請今日/未來 + 只能本月/未來 + 可取消未來
- API 驗：`date >= getCheckinDayTaipei()`（今日或未來）；`date` 所屬月 ≥ 當前月且該月未月結。
- 取消：僅 `date >= 今日` 可 DELETE。過去請假凍結（與請假對稱）。

### 決策 6：月結可重現
- settlement 撈該月 leave_records 傳入 calcMonthStats。因 leave_records 持久化，重跑分母一致。與現有「refDate=min(today,monthEnd)」邏輯正交，不衝突。

## Risks / Trade-offs

- **[13+ 呼叫點漏改 → 分母不一致]** 最大風險。某頁扣了請假、某頁沒扣 → 同一人不同頁達成率不同。→ 抽 `fetchLeaveDates` helper + 分母函式加參數；逐一補全並以「同一人多頁一致」驗收。tasks 逐點列出。
- **[誠信濫用]** 學員自行請假可能空轉。→ 「只能請今日/未來」擋事後追認（最大漏洞）；不設月上限（使用者選）。日後若濫用再加上限。
- **[事由清單為空]** 沒事由學員無法請假。→ 後台至少維護一個；UI 空清單時提示「暫無可選事由」。
- **[請假日恰好有打卡]** 「只能請今未來」下極少見（未來日還沒到、不會有打卡）；今日若已打卡再請假——採「請假優先，該日不計分，已打分數不計分子」。API 可擋「今日已打卡則不可請假」或允許覆蓋，實作時取簡單者（傾向：今日已打卡仍可請假，該日整筆不計分）。
- **[工時分母不動的一致性]** 請假日仍算工作日 → 工時扣分分母未縮。使用者本次不動工時；若造成請假日仍被要求工時，另議。design 標記為已知取捨。

## Migration Plan

- **DB migration**：建 `leave_records`、`leave_reasons` 兩表（schema.sql + migrations 各一支）。
- **程式**：`lib/leave.ts`（fetchLeaveDates）→ 分母函式加參數 → 13+ 呼叫點補傳 → settlement → 請假 API（POST/DELETE）→ 事由後台 API+UI → 打卡頁請假 UI。
- **回滾**：移除兩表、分母參數（預設空集合使既有行為不變）、UI/API。分母函式參數選填 → 移除低風險。
- **上線前置**：Supabase 跑 migration；後台先建至少一個事由。
- **驗證**：請假某日 → 達成率分母 −1 天、多頁一致；破曉王/pace 分母同步；月結扣請假且重跑一致；不可請過去/已月結；取消恢復分母。

## Open Questions

- 今日已打卡後才請假——該日分數是否要視覺提示「已請假、不計分」？傾向提示，避免學員困惑「我明明打了」。
- 工時扣分的工作日分母要不要也扣請假日——本次不動（Non-Goal），若請假日仍被要求工時造成不合理，另案。
- 請假是否顯示於儀表板日曆（如標「假」）——傾向顯，讓學員看見；非核心，可後加。
- 事由是否需「其他（自填）」選項——使用者選「後台清單下拉、不自由打字」，暫不做自填。
