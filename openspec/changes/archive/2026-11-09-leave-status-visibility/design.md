# Design

## Context

請假日目前只透過 `lib/leave.ts` 的 `fetchLeaveDates(db, memberIds, yearMonth)` 影響兩處分母計算（`GET /api/stats/dashboard` 的 `calcMonthStats`、`GET /api/admin/penalty` 的罰款計算），完全沒有接到任何「顯示某日狀態」的程式路徑：

- `components/CalendarGrid.tsx`：純粹依 `day.score` 決定顏色（`getCalendarColor`），`day.color` 由後端 `getCalendarColor(score)` 算好傳入；請假日 `score = null`（因為該日沒有 `checkin_records`），所以會跟「未報」拿到同一個灰色。
- `app/(main)/admin/page.tsx` 的個人逐日明細表（`/api/admin/member-records`）：完全沒有呼叫 `fetchLeaveDates`，`累計率` 欄位是前端用 `dates.length * 8` 當分母、`recMap[date]` 有記錄才加分子，請假日因為沒有 `checkin_records` 而被當成 0 分計入分子（視覺上顯示「（無記錄）」），且分母從未扣除請假天數——這是一個既有的計算 bug，與 `calcMonthStats` 的口徑不一致。

見 proposal.md - Why / What Changes；規格見 `specs/dashboard-stats/spec.md`、`specs/leave-request/spec.md`。

## Goals / Non-Goals

**Goals:**
- `CalendarGrid`（打卡頁、儀表板共用）能區分請假日與未報日，且可查看事由
- 管理後台個人逐日明細表能區分請假列與無記錄列，且累計率分母與系統其餘「累計率」口徑一致（扣除請假天數）
- 兩處皆透過既有 `fetchLeaveDates` 取得請假資料，不新增查詢邏輯分支

**Non-Goals:**
- 不改變請假本身的業務規則（誰能請、何時能請、能否追認過去）—— 那是 `leave-request` 既有需求範圍，本次只新增「可見性」
- 不新增「查詢某人歷史請假列表」的獨立頁面或 API（例如「請假紀錄」Tab）；本次只在既有畫面補上請假狀態顯示，不建新頁面
- 不處理管理後台「全員進度」摘要表（`/api/stats/progress`，即姓名/階梯/總分/達成率那張表）的請假顯示——該表是整月彙總數字，不是逐日視圖，請假天數已經反映在它的達成率數字裡（因為它用 `calcMonthStats`），不存在「某一列是請假」的概念，故不在本次範圍

## Decisions

### 1. `calendar[]` 新增 `isLeave` / `leaveReason` 欄位，而非新增獨立的 `/api/stats/leave` 查詢
**選擇**：`GET /api/stats/dashboard` 既有程式碼已經呼叫 `fetchLeaveDates(db, [member.id], yearMonth)` 算分母（`app/api/stats/dashboard/route.ts:48` 附近），直接複用這次查詢結果，組 `calendar[]` 時一併查 `leaveDates.has(d)` 設定 `isLeave`。事由（`leaveReason`）需要額外一次查詢 `leave_records.reason`（`fetchLeaveDates` 目前只回傳日期集合，不含事由）。

**理由**：避免為了拿事由新增一條平行的請假查詢 API；同一個 request 內把「分母用的日期集合」與「顯示用的事由」都準備好，維持「一次查詢、多處使用」。

**替代方案考慮**：讓前端另外呼叫一個新 `/api/checkin/leave-records?month=` 查事由——會造成請假判定邏輯（「這天算不算請假」）分裂成兩個查詢結果，有機率出現 race condition 或不一致，不採用。

### 2. `fetchLeaveDates` 增加一個可選的「含事由」回傳模式，而非新建函式
**選擇**：在 `lib/leave.ts` 新增 `fetchLeaveRecords(db, memberIds, yearMonth)`（回傳 `Record<memberId, Map<date, reason>>`），`fetchLeaveDates` 內部改為呼叫它並取 key 集合（保持既有呼叫端 API 不變、行為不變）。新呼叫端（dashboard route、member-records route）改用 `fetchLeaveRecords` 取得事由。

**理由**：`fetchLeaveDates` 現有簽章與回傳型別被多處呼叫（`dashboard/route.ts`、`admin/penalty/route.ts`），任何簽章異動都會波及既有呼叫端；用新函式包裝、舊函式委派的方式零風險地擴充能力，同時保證兩者資料來源完全一致（同一個 DB 查詢，只是回傳形狀不同）。

**替代方案考慮**：直接改 `fetchLeaveDates` 回傳型別——會破壞 `admin/penalty/route.ts` 現有的 `Set<string>` 用法，需要連動修改非本次範圍的程式碼，不採用。

### 3. 管理後台個人逐日明細表：後端算好 `isLeave` + 正確分母，前端不再自己算累計率分母
**選擇**：`GET /api/admin/member-records` 新增呼叫 `fetchLeaveRecords`，回傳中新增 `leaveByDate: Record<string, string>`（日期→事由）。前端 `app/(main)/admin/page.tsx` 的 `rows` 計算邏輯改為：請假日 SHALL 跳過分子分母的累加（如同該日不存在，呼應 `leave-request` 既有「分子分母皆移」原則），表格該列顯示「請假（事由）」。

**理由**：與 `calcMonthStats` 的既有口徑（請假日从分子分母都移除）完全對齊，修正現有的分母 bug；計算邏輯雖然留在前端（這張表目前整體就是前端算 `cumRate`，不動既有架構），但資料來源統一改用後端已算好的請假集合，不在前端重新發明請假判定規則。

**替代方案考慮**：把整個累計率計算搬到後端 API 算好直接回傳——改動面更大（牽涉這張表目前「即時逐日累計」的呈現方式），超出本次「補上請假可見性 + 修正既有分母 bug」的範圍，留待未來若有更多此類需求再評估是否整體重構這張表。

### 4. `CalendarGrid` 請假樣式：新增第六種顏色 token，複用既有 `note` 互動模式顯示事由
**選擇**：`lib/constants.ts` 的 `CALENDAR_COLORS` 新增 `leave` token（例如藍色系，與既有紅/橘/綠/金/灰五色區隔）。`CalendarGrid` 的 `CalendarDay` 介面新增 `isLeave?: boolean` 與沿用既有 `note?: string`欄位放請假事由文字（例如 `請假：大堂課請假`），複用元件既有的「有 note 就可點擊看備註面板」互動，不新增新的 hover/點擊機制。

**理由**：`CalendarGrid` 已經有「點擊格子顯示備註面板」的成熟互動（目前用於打卡時填寫的 `note`），請假事由用同一套 UI 呈現最省力、也最一致；顏色選擇上只要求「與既有五色皆不同」，具體色值在實作階段依現有色彩系統（Tailwind 既有色階）挑選即可。

## Risks / Trade-offs

- **[風險] 修正管理後台逐日明細表的累計率分母後，數字會與修正前不同（即使沒有新請假）** → 可接受且預期：這是修正既有計算 bug，修正後的數字才是正確的（與 `calcMonthStats` 口徑一致）；proposal.md 已標記為行為修正並說明原因，非資料遺失或功能移除。
- **[風險] `fetchLeaveRecords` 與既有 `fetchLeaveDates` 若未來維護者各自修改，可能再度分裂** → 緩解：`fetchLeaveDates` 內部委派給 `fetchLeaveRecords`，兩者只有一份查詢邏輯，程式碼層面強制保持一致。
- **[風險] 新增一次事由查詢（`leave_records.reason`）會為 dashboard API 與 member-records API 各增加一次 DB 查詢** → 可接受：查詢範圍限定在單一成員單一月份，資料量小，與現有程式已有的多重查詢（如 `fetchLeaveDates` 本身）同量級。
- **[Trade-off] 不處理「全員進度」摘要表與不新增獨立請假查詢頁** → 可接受：本次鎖定在使用者實際卡關的兩個畫面（月曆、逐日明細），摘要表的達成率數字已經正確反映請假影響，不存在误导風險。
