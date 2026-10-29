# Tasks

## 1. 文案更新

- [x] 1.1 [components/MonthProgressCard.tsx](../../../components/MonthProgressCard.tsx) 的 `targetStatus === 'unreachable'` 區塊文案由「本月已難達標，下月再拼！」改為「為自己的心而做，能量會累積，不要放棄 💫」
- [x] 1.2 `npx tsc --noEmit`、`npm run lint` 通過

## 2. 驗證

- [x] 2.1 手動以 `npm run dev` 驗證：找一位本月日均需分 > 8（已難達標）的成員登入，確認 `/dashboard` 頁與打卡頁「本月進度」彈窗皆顯示新文案 — 使用者已驗收正常
- [x] 2.2 手動驗證其餘兩種情境（已達標、一般）文案未受影響 — 使用者已驗收正常
