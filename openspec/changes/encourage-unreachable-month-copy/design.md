# Design

## Context

單一字串文案變更，位於 [components/MonthProgressCard.tsx:72](../../../components/MonthProgressCard.tsx)，由 `targetStatus === 'unreachable'` 條件觸發渲染。該元件被 `/dashboard` 頁與打卡頁「首次打卡後顯示本月進度彈窗」共用，改一處即兩邊生效。見 proposal.md - Why / What Changes。

## Goals / Non-Goals

**Goals:**
- 把「已難達標」情境的文案換成鼓勵持續、不誤導可追回的語意

**Non-Goals:**
- 不改變 `targetStatus` 的計算/觸發邏輯
- 不改變其餘兩種情境（已達標、一般）的文案或樣式
- 不新增 A/B 測試或可配置文案機制——這是單一寫死字串，與既有兩種情境的實作方式一致

## Decisions

無需要權衡的技術決策——純粹替換 JSX 內的字串字面值，不涉及資料結構、API 或狀態管理變更。

## Risks / Trade-offs

- **[風險] 無**：單一字串變更，不影響任何計算邏輯或資料流，風險面極小。
