## Why

系統目前缺乏社交互動機制，成員各自打卡，缺少相互督促與激勵的連結。新增夥伴機制，讓成員可以互相綁定、看見彼此的打卡進度並給予鼓勵，以提升定課意願與持續性，設計參考多鄰國好友聯盟功能。

## What Changes

- **新增** 雙向夥伴邀請系統（申請 → 接受/拒絕，最多 10 位夥伴）
- **新增** 夥伴打卡資訊顯示（今日是否打卡、今日任務項目、本月達成率、連續天數）
- **新增** 鼓勵互動功能（每人每夥伴每日限一次）
- **新增** 9 個夥伴相關成就（社交類、競爭類、同步類、鼓勵類）
- **新增** `/partners` 頁面（三分頁：我的夥伴 / 邀請管理 / 尋找夥伴）
- **修改** Dashboard 頁面：新增夥伴動態區塊（最多 3 位精簡卡）
- **修改** Navbar：新增「夥伴」導覽項目

## Capabilities

### New Capabilities

- `partner-invitations`: 夥伴邀請管理 — 雙向確認邀請流程，含發送、接受、拒絕、取消及上限控制
- `partner-display`: 夥伴資訊顯示 — 即時查看夥伴打卡狀況、本月達成率、連續天數、今日任務項目
- `partner-encouragement`: 鼓勵互動 — 每人每夥伴每日一次鼓勵送出，並顯示收到次數
- `partner-achievements`: 夥伴成就系統 — 社交、競爭、同步、鼓勵四類共 9 個新成就

### Modified Capabilities

（無現有規格需變更）

## Impact

- **新增資料表**：`partner_requests`（夥伴關係）、`encouragements`（鼓勵紀錄）
- **新增 API 路由**：`/api/partners/*`（7 個端點）
- **修改 API 路由**：`/api/checkin/submit`（提交打卡後觸發夥伴成就）、`/api/stats/dashboard`（加入夥伴快照）
- **新增頁面**：`app/(main)/partners/page.tsx`
- **修改頁面**：`app/(main)/dashboard/page.tsx`、`components/Navbar.tsx`
- **修改共用資料**：`lib/constants.ts`（9 個新成就）、`lib/scoring.ts`（新增 `calcPartnerSyncStreak`）
- **修改型別定義**：`types/index.ts`（`PartnerCard`、`PartnerInvitation`）
- **新增 DB 遷移**：`supabase/migrations/20260430_partners.sql`
