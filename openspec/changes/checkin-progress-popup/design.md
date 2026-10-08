# Design

## Context

打卡頁（[app/(main)/checkin/page.tsx](../../../app/(main)/checkin/page.tsx)）的 `handleSubmit()` 目前對 POST／PATCH 共用同一條路徑：送出、拿到 `json.ok`，依 `isEditing` 分流處理 toast 與成就 Modal（`achQueue` / `showAch`），最後呼叫 `loadData()` 重抓 `/api/checkin/today`。

`/dashboard` 頁（[app/(main)/dashboard/page.tsx](../../../app/(main)/dashboard/page.tsx)）的「月度進度卡」已經是完整可重用的 JSX 區塊：累計得分/達成率/距目標差三欄數字 + 日均達標提醒一句話 + `<DailyRateChart />`（三線折線圖，見 [dashboard-chart-self-comparison](../dashboard-chart-self-comparison/) 變更）。資料來源是 `GET /api/stats/dashboard`（免 `month` 參數即回傳當月）。

兩頁目前分屬不同 route，各自獨立 fetch、各自的 `DashboardData` / `TodayData` 型別，彼此沒有共用元件。

參考 proposal.md - Why / What Changes；規格見 `specs/daily-checkin/spec.md`。

## Goals / Non-Goals

**Goals:**
- 首次打卡成功後，在不離開打卡頁的情況下，讓成員看到本月進度卡 + 三線折線圖
- 進度卡 JSX 不要在 checkin 頁重寫一份，抽成共用元件讓 dashboard 頁與 checkin 頁都用同一份
- 彈窗資料改為獨立非同步請求（打卡成功後才打），不拖慢 `/api/checkin/submit` 本身的回應時間
- 成就彈窗與進度彈窗的顯示順序明確、不互相覆蓋

**Non-Goals:**
- 不改變 `/dashboard` 頁本身的行為或版面
- 不改變 `POST`/`PATCH /api/checkin/submit` 的 API 回應格式
- 不處理「歷史月份」情境（進度彈窗只會在打卡當下、即當月現時視圖觸發，不涉及月份導覽）
- 不在本次變更中處理離線/無網路時進度彈窗的重試機制（loading 失敗僅 toast 提示，不特別設計重試 UI）

## Decisions

### 1. 抽出共用元件 `MonthProgressCard`，而非直接複製 JSX
**選擇**：把 dashboard 頁「月度進度卡」的 JSX（三欄數字 + 日均提醒文案 + `<DailyRateChart />`）抽成 `components/MonthProgressCard.tsx`，接受與 `/api/stats/dashboard` 回應對應的 props（`totalScore`, `rate`, `targetScore`, `remaining`, `daysLeft`, `dailyNeeded`, `targetStatus`, `user.level`, `calendar`, `lastMonthDailyRates`, `historicalAvgDailyRates`）。dashboard 頁與 checkin 頁的彈窗都改用這個元件。

**理由**：避免兩頁各自維護一份幾乎相同的 JSX（含「已達標/還有 N 天/已難達標」三種文案分支），之後若調整進度卡樣式只需改一處。`DailyRateChart` 已經是獨立元件，`MonthProgressCard` 是再往上一層的組合元件。

**替代方案考慮**：直接在 checkin 頁重寫一份精簡版 JSX——會導致後續任何進度卡文案/配色調整要同步改兩處，且與既有專案「共用邏輯抽出」慣例（如 `lib/scoring.ts` 純函式）不一致，故不採用。

### 2. 進度彈窗資料：打卡成功後另發 `GET /api/stats/dashboard`，不塞進 submit 回應
**選擇**：`handleSubmit()` 的 POST 成功分支，在成就佇列清空後（或無成就時立即），呼叫 `fetch('/api/stats/dashboard')` 取得當月資料，用於渲染 `MonthProgressCard`。該請求期間彈窗顯示 loading skeleton；失敗則 toast 提示「進度載入失敗」並仍保留原本的「今日已打卡」確認卡（不影響打卡本身已成功的事實）。

**理由**：`POST /api/checkin/submit` 的職責是「寫入打卡記錄」，`GET /api/stats/dashboard` 的職責是「讀取月度統計」，兩者維持既有的單一職責分工；合併回應會讓 submit API 耦合儀表板的查詢邏輯（多個額外 DB 查詢），不符合專案現有 API 切分方式。

**替代方案考慮**：讓後端 `submit` 的回應直接夾帶月度統計——效能上省一次 round-trip，但大幅增加 submit 路徑的查詢量與耦合度，且 dashboard 查詢邏輯已經不輕（近 6 月趨勢、歷史累積平均等），不值得為了省一次請求而耦合。

### 3. 觸發時機：只在 `isEditing === false` 的 POST 成功分支
**選擇**：`handleSubmit()` 已經用 `isEditing` 區分 POST / PATCH；進度彈窗只在 `!isEditing` 分支的成功路徑觸發，PATCH 分支維持現狀（toast + 可能的成就對帳提示），不新增彈窗。

**理由**：符合 proposal 的明確決策（修改打卡不觸發），實作上只是在既有 if/else 分支裡新增一行呼叫，風險最低。

### 4. 與成就彈窗佇列銜接：用 `achQueue` 清空作為觸發點
**選擇**：沿用既有 `achQueue` / `showAch` 狀態機制。新增一個 `showProgress` 狀態；POST 成功時：
- 若 `newAchievements.length > 0`：設定 `achQueue`、`showAch = true`，同時標記「待顯示進度彈窗」（例如 `pendingProgressRef.current = true`，或複用 `useEffect` 監看 `achQueue.length === 0 && pendingProgress`）。既有 `dismissAch()` 在佇列清空的那一刻（`next.length === 0`）觸發進度資料的 fetch + 開啟。
- 若 `newAchievements.length === 0`：直接 fetch + 開啟進度彈窗。

**理由**：兩個 Dialog（成就、進度）用 Radix Dialog（專案既有 `components/ui/dialog.tsx`）實作，同時 `open` 兩個 Dialog 在視覺上會疊加，必須序列化；用既有 `dismissAch()` 的清空時機作為「交棒」點，是改動最小、沿用既有狀態機的做法。

**替代方案考慮**：把兩個 Dialog 合併成一個多步驟 Modal（成就頁 → 進度頁，同一個 Dialog 元件切換內容）——會動到既有成就 Modal 的既有結構與樣式，改動面更大，且成就 Modal 未來可能有其他呼叫情境（如編輯打卡新增成就），不應該被進度彈窗的顯示邏輯綁死，故不採用。

## Risks / Trade-offs

- **[風險] 打卡成功後多一次網路請求，弱網路環境下彈窗會有明顯 loading 延遲** → 緩解：彈窗先以 loading skeleton 開啟（而非等資料回來才開 Dialog），讓使用者至少立即看到「進度載入中」的回饋；失敗則 toast + 關閉彈窗，不卡住整體打卡流程。
- **[風險] `MonthProgressCard` 抽出共用元件可能在抽取過程中不小心動到 dashboard 頁既有行為（月份導覽、下月階梯選擇等鄰近區塊）** → 緩解：抽取範圍嚴格限定在「進度卡」區塊本身（三欄數字 + 日均提醒 + 折線圖），不包含下月階梯選擇、月曆、任務統計等其他 dashboard 卡片；抽取後需跑 `npx tsc --noEmit` 並手動比對 dashboard 頁視覺無變化。
- **[風險] 使用者快速連續操作（例如打卡後立刻點擊其他按鈕）可能與非同步載入的進度彈窗產生競態** → 緩解：沿用 dashboard 頁既有的 `AbortController` 慣例，彈窗關閉時 abort 尚未完成的 fetch。
- **[Trade-off] 不做歷史月份情境** → 可接受：此彈窗情境定義明確是「打卡當下看本月」，不需要支援月份導覽，降低實作複雜度。
