# Design

## Context

`lib/daily-status.ts` 的三個純函式目前的請假盲點：

- `buildDailySnapshot()`（[lib/daily-status.ts:55-83](../../../lib/daily-status.ts)）：`hasToday = records.some(r => r.date === date)` 只看 `checkin_records`，`missed`/`miss_streak` 完全不理會 `leaveByMember` 參數——雖然函式簽章已經接受 `leaveByMember`，但只傳給 `calcMonthStats`（算分母），沒用在漏卡判定本身。
- `diffStatusEvents()`：純粹比對前後兩日 `DailyStatus`，不知道「請假」這個概念，但因為它只讀 `missed`/`passing`/`miss_streak` 欄位，只要這些欄位在 `buildDailySnapshot()` 被正確計算（請假日 `missed=false`），`diffStatusEvents()` 本身理論上不需要改動邏輯就能正確運作——這是本次設計的關鍵判斷點。
- `formatDigestMessage()`：`missed` 陣列直接來自 `snapshot.filter(s => s.missed && !longIds.has(...))`，請假者因為 `missed` 已經是 `true` 而混入。

`app/api/cron/daily-digest/route.ts` 已經呼叫 `fetchLeaveDates(db, memberIds, targetYearMonth)` 並把 `leaveByMember` 傳給 `buildDailySnapshot`、`formatDigestMessage`，呼叫端的資料準備是完整的，缺口完全在 `lib/daily-status.ts` 內部三個函式沒有真正使用它。

參考 proposal.md - Why / What Changes；規格見 `specs/daily-status-digest/spec.md`。

## Goals / Non-Goals

**Goals:**
- 請假日的 `missed` 判定正確（不計入漏卡）
- `miss_streak` 在請假日「原地不動」（不累進也不歸零），讓請假前後的缺卡連續性正確銜接
- `diffStatusEvents` 不需要知道「請假」概念也能產生正確事件（靠 `missed` 欄位值本身已經排除請假的事實）
- 摘要訊息新增請假名單區塊，漏卡名單排除請假者
- `daily_status_snapshot` 新增 `is_leave` 欄位，作為「當下事實快照」的一部分（未來若要回頭分析「某天漏卡 vs 請假的比例」可直接查快照表，不需要重新 join `leave_records`）

**Non-Goals:**
- 不改變 `calcMonthStats`/`calcPaceStatus` 的請假分母計算（已經正確，不動）
- 不處理「請假與打卡同時存在」的衝突情境（`leave-status-visibility` 變更已在 `manual_leave.py` 腳本層面做過這類互斥檢查；一般請假 API `POST /api/checkin/leave` 本身就不允許請假日再打卡，`checkin_records` 與 `leave_records` 正常情況下不會同時存在同一天）
- 不回填歷史 `daily_status_snapshot` 的 `is_leave` 欄位（新欄位預設 `false`，歷史資料本來就沒有這個區分，不視為資料遺失）

## Decisions

### 1. `miss_streak` 在請假日「原地不動」，而非歸零或當作特殊值
**選擇**：`buildDailySnapshot()` 判斷順序改為：
```
if (請假)      → missed=false, miss_streak=延續前一日的值, is_leave=true
else if (有打卡) → missed=false, miss_streak=0,             is_leave=false
else           → missed=true,  miss_streak=前一日+1,        is_leave=false
```

**理由**：呼應 proposal 與 `leave-request` 既有「請假日如同不存在」的原則（`calcMonthStats`/`expectedCheckinDays` 已經是這個邏輯）。若請假日讓 `miss_streak` 歸零，會讓一個正在缺卡 10 天的成員，因為某天請假而「洗白」連續缺卡記錄，事實上他只是那天有正當理由、前後的缺卡事實沒有改變；若請假日讓 `miss_streak` 正常 +1，則請假會被誤記為缺卡的一部分，與「不計入漏卡」的目標矛盾。「原地不動」是唯一同時滿足「不算漏卡」與「不洗白缺卡記錄」的選項。

**替代方案考慮**：
- 請假日 `miss_streak` 歸零——拒絕，會讓長期缺席者透過請假「重置」告警，變相鼓勵用請假規避長期缺席偵測。
- 請假日 `miss_streak` 正常累進——拒絕，直接違反 proposal 的核心訴求（請假不算漏卡）。

### 2. `diffStatusEvents()` 不改動核心比對邏輯，靠 `missed` 欄位值本身的正確性間接修正
**選擇**：不修改 `diffStatusEvents()` 的比對規則本身（仍是單純比對 `missed`/`passing`/`miss_streak` 的前後轉移），因為只要 `buildDailySnapshot()` 吐出的 `missed` 值已經正確排除請假，「開始缺卡」「回歸」事件的判定自然正確：
- 請假日 `missed=false`：若前一日也是 `missed=false`（已打卡或請假），無轉移、無事件。
- 若前一日 `missed=true`（缺卡中），請假日變成 `missed=false`——這會被現有邏輯判定為「回歸」事件，但語意上成員並未真正回來打卡，只是請假。

**但**設計決策 1 已經讓「缺卡中去請假」這個情境的 `missed` 從 `true→false`，**仍會觸發「回歸」事件**，這點 proposal 與 spec 的 scenario「缺卡中請假不誤報回歸」要求 MUST NOT 觸發。因此 `diffStatusEvents()` 仍需要一個小改動：事件判定時額外讀取 `is_leave`，若當日 `is_leave=true`，MUST NOT 觸發「回歸」事件（即使 `missed` 從 `true→false`）。「開始缺卡」事件則不受影響，因為請假日 `missed` 恆為 `false`，不會從 `false→true`。

**結論**：`diffStatusEvents()` 新增一個條件：`回歸` 事件的觸發條件追加「且 `c.is_leave` 為假」。`DailyStatus` 介面需要新增 `is_leave` 欄位（與 `missed`/`rate`/`passing` 同層級，一併寫入快照）。

**替代方案考慮**：讓請假日的 `missed` 維持前一日原值（而非一律 `false`）——這樣可以不改 `diffStatusEvents`，但會讓「漏卡名單」判定（`formatDigestMessage` 直接篩 `missed`）複雜化（還要另外查 `is_leave` 才能排除），且不符合「請假當下就是不算漏卡」的直覺事實快照定義。維持 `missed=false` + `diffStatusEvents` 讀 `is_leave` 的小改動，整體更清晰。

### 3. `formatDigestMessage()` 新增請假名單區塊，直接篩 `is_leave`
**選擇**：`missed = snapshot.filter(s => s.missed && !longIds.has(...))` 本身不需要改（因為請假日 `missed` 已經是 `false`，天然被排除），只需新增 `onLeave = snapshot.filter(s => s.is_leave)`，在漏卡區塊之後插入「📝 今日請假 N 人」區塊（比照既有「❌ 漏卡」「💤 長期缺席」的呈現風格：有則列出姓名＋事由，無則省略整段或顯示「（無）」——沿用既有「漏卡」區塊「（無）」的呈現慣例以保持一致）。

事由需要從 `leaveByMember` 取得——`lib/leave.ts` 已經有 `fetchLeaveRecords(db, memberIds, yearMonth)`（回傳 `Record<memberId, Map<date, reason>>`，由 `leave-status-visibility` 變更新增），`fetchLeaveDates` 委派給它。`daily-digest/route.ts` 的 `fetchLeaveDates` 呼叫 SHALL 改為 `fetchLeaveRecords`，讓 `formatDigestMessage` 能顯示「姓名（事由）」。

**理由**：複用既有 `fetchLeaveRecords` / `fetchLeaveDates` 委派關係，不重新發明請假查詢。

### 4. `daily_status_snapshot` 新增 `is_leave BOOLEAN NOT NULL DEFAULT FALSE` 欄位
**選擇**：寫一筆新 migration（`supabase/migrations/`），比照既有欄位風格新增 `is_leave BOOLEAN NOT NULL DEFAULT FALSE`。`DailyStatus` TS 介面與 `buildDailySnapshot()` 回傳值同步新增 `is_leave` 欄位；upsert 時一併寫入。

**理由**：`is_leave` 屬於「當下事實快照」的一部分（與 `missed`/`rate`/`passing` 同一性質——寫入當下為準，不因請假紀錄事後變動而重算），理應跟其他快照欄位一樣持久化在 `daily_status_snapshot`，而非每次產生摘要時動態重新查 `leave_records` 判斷。這也讓未來若要回溯分析「某成員全年漏卡 vs 請假比例」可以直接查快照表。

**替代方案考慮**：不新增欄位，`formatDigestMessage()` 呼叫時動態查 `leave_records` 判斷——這樣省一次 migration，但违反「快照內容為當下事實且不可重算」的既有核心原則（若之後 `leave_records` 被管理員事後修改或刪除，歷史摘要產生時間點查到的請假狀態就會與快照不一致），選擇持久化欄位更穩妥。

## Risks / Trade-offs

- **[風險] `daily_status_snapshot` 新增欄位需要一筆 migration，部署時機需晚於程式碼更新或兩者同時** → 緩解：欄位為 `NOT NULL DEFAULT FALSE`，新增不會破壞既有查詢；依照專案既有流程於 Supabase SQL Editor 手動套用，不需要特殊部署協調。
- **[風險] `diffStatusEvents()` 的「回歸」事件需要讀取當日 `is_leave`，簽章或資料結構若遺漏傳遞會悄悄失效（請假當天仍誤報回歸）** → 緩解：`DailyStatus` 介面本身就包含 `is_leave`（設計決策 2），`diffStatusEvents` 讀取同一個 `curr: DailyStatus[]` 陣列，不需要額外參數，不存在「忘記傳遞」的可能。
- **[Trade-off] 不回填歷史快照的 `is_leave`** → 可接受：這是新增的分類維度，歷史資料本來就不存在這個區分，回填需要重新比對 `leave_records` 與既有快照的時間窗，超出本次「修正中午推播」的範圍，且歷史摘要已經推播過，回填不會改變已發生的通知內容。
