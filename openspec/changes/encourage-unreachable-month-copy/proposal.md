# Proposal

## Why

本月進度卡在「已難達標」情境（`targetStatus === 'unreachable'`）目前顯示「本月已難達標，下月再拼！」，這句話隱含「這個月沒救了」的放棄訊號，容易讓學員在月底幾天直接停止打卡——而這幾天其實仍然可以累積得分、維持連續打拳、朝成就邁進，只是數學上追不回當月通關門檻而已。文案應該把焦點從「這個月輸了」轉成「持續本身仍有價值」，降低月底棄賽率。

## What Changes

- 「已難達標」情境文案由「本月已難達標，下月再拼！」改為「為自己的心而做，能量會累積，不要放棄 💫」。
- 僅改文案字串本身，不改變 `targetStatus === 'unreachable'` 的觸發條件（`dailyNeeded > 8`）、不改變「已達標」「一般」兩種情境的文案與邏輯。
- 既有「MUST NOT 誤導學員以為可追回」的約束不變：新文案聚焦「持續做的意義」而非「還有機會達標」，不會讓學員誤判還能追回當月目標。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `dashboard-daily-target`: 「日均提醒的三情境呈現」需求中「已難達標」情境的文案內容變更。

## Impact

- **前端**：[components/MonthProgressCard.tsx](../../../components/MonthProgressCard.tsx)（唯一顯示此文案的位置，被 `/dashboard` 頁與打卡頁「首次打卡後顯示本月進度彈窗」共用，兩處會一併生效，不需個別修改）。
- **不影響**：`targetStatus` 計算邏輯（`app/api/stats/dashboard/route.ts`）、其餘兩種情境文案、API 回應格式皆不變。
