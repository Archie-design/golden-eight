## Why

學員偶有正當事由（生病、出差、家事）無法完成當日打卡。目前這些日子照算進達成率分母，拉低完成率、可能導致不公平的罰款。加入「請假」功能：學員針對某邏輯日請假後，該日從計分分母移除（如九月 30 天，9/1 請假則只看剩下 29 天），使達成率反映「有效天數」的真實表現。

## What Changes

- **新增請假機制**：學員針對某邏輯日請假 → 該日**分子分母都移除**（就像那天不存在）。
- **只能請今日或未來**：不能回頭把過去的日子（含已漏卡日）追認為請假——請假是事先告知，非事後補救。此限制大幅避免「月底看苗頭不對才補請假」的濫用，也免去「請假日已有打卡分數」的競態。
- **學員自行請假（誠信原則）**：學員可自己請假，不需管理員核准；靠「只能請今日/未來」防濫用。
- **事由由後台設定**：管理員維護一份預設事由清單，學員請假時下拉選一個。
- **月結邊界**：只能請本月或未來月份；已月結的歷史月份不可動（罰款已定案）。
- **入口在打卡頁**：學員於打卡頁請今日假（選事由 → 送出）。

核心：**請假日從兩條分母動脈移除**——達成率分母（`calcMonthStats.maxScore`）與破曉王/pace 分母（`expectedCheckinDays`），使所有依賴分母的計算（達成率、達標、罰款、破曉王、pace、月結）自動反映有效天數。

## Capabilities

### New Capabilities
- `leave-request`: 學員請假的能力——涵蓋針對邏輯日請假（今日或未來）、後台事由清單與下拉選擇、誠信自行請假、請假日從計分分母移除（分子分母皆移）、月結重現，以及與達成率/破曉王/pace/月結各分母的連動。

### Modified Capabilities
- `daily-checkin`: 打卡頁新增「今日請假」入口；請假日不參與計分（分母移除）。
- `monthly-settlement`: 月結計算分母時扣除請假日，且請假資料可重現（重跑不變）。

## Impact

**新增：**
- `leave_records` 表（`member_id`, `date`, `reason`, `created_at`；UNIQUE(member_id, date)）+ migration + schema.sql。
- `leave_reasons` 事由清單（後台設定；小表或設定機制）。
- 學員請假 API：`POST /api/checkin/leave`（今日/未來、驗事由）、`DELETE`（取消）。
- 後台事由管理 API + UI。
- 打卡頁請假入口 UI。

**改分母（核心，牽動計分鏈）：**
- `lib/scoring.ts` `calcMonthStats`：maxScore 扣「該月請假天數 × 8」——需傳入該成員該月請假日集合（新參數）。
- `lib/scoring.ts` `expectedCheckinDays`：應打卡天數扣請假日（破曉王/pace 分母）。
- `lib/settlement.ts`：月結撈請假日、傳入分母計算；重跑可重現。

**13+ 呼叫點連帶（各需撈該成員該月請假日傳入分母函式）：**
- `app/api/stats/{dashboard,progress,leaderboard,history}/route.ts`、`app/api/checkin/today/route.ts`、`app/api/admin/penalty/route.ts`、`app/api/partners/route.ts`、`app/api/cron/daily-digest/route.ts`、`app/api/line/webhook/route.ts`、`lib/daily-status.ts`、`lib/partner-achievements.ts`。
- 這些呼叫 `calcMonthStats`/`expectedCheckinDays` 之處，都需一併查請假日並傳入，否則分母不一致。

不改 8 項任務邏輯、罰金金額、門檻。請假只影響「有效天數」，不影響已請假前的分數。
