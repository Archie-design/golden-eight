## 1. DB 與型別

- [x] 1.1 migration：建 `leave_records(id, member_id, date DATE, reason TEXT, created_at, UNIQUE(member_id,date))`
- [x] 1.2 migration：建 `leave_reasons(id, label TEXT, active BOOL, sort_order INT)`
- [x] 1.3 `supabase/schema.sql` 同步兩表；RLS enable（service_role 繞過）
- [x] 1.4 `types/index.ts`：加 `LeaveRecord`、`LeaveReason` 型別

## 2. 請假日查詢 helper（lib/leave.ts）

- [x] 2.1 `fetchLeaveDates(db, memberIds, yearMonth) → Record<memberId, Set<date>>`（該月請假日集合）
- [x] 2.2 供全員（排行/digest）與單人（儀表板/today）兩種呼叫

## 3. 分母函式加參數（lib/scoring.ts）

- [x] 3.1 `calcMonthStats(member, records, refDate, leaveDates?)`：`fullMonthDays` 扣 [effectiveStart,monthEnd] 內的請假日；`maxScore=(fullMonthDays−leaveCount)×8`；leaveDates 選填預設空（既有呼叫不變）
- [x] 3.2 `expectedCheckinDays(member, ym, refDate, leaveDates?)`：應打卡天數扣 ≤refDate 的請假日；選填預設空
- [x] 3.3 邊界：請假日全月、請假日超出有效窗口、leaveDates 空 → 行為等同現況

## 4. 所有分母呼叫點補傳請假日（逐點）

- [x] 4.1 `app/api/stats/dashboard/route.ts`：撈該成員該月請假日 → 傳入 calcMonthStats（含 runLog/pace/日均分母一致）
- [x] 4.2 `app/api/stats/progress/route.ts`：全員請假日 → calcMonthStats + calcPaceStatus + expectedCheckinDays
- [x] 4.3 `app/api/stats/leaderboard/route.ts`：全員請假日 → calcMonthStats + isDawnKing
- [x] 4.4 `app/api/stats/history/route.ts`：各月請假日 → calcMonthStats
- [x] 4.5 `app/api/checkin/today/route.ts`：該成員該月請假日 → calcMonthStats（monthRate）
- [x] 4.6 `app/api/admin/penalty/route.ts`：全員請假日 → calcMonthStats
- [x] 4.7 `app/api/partners/route.ts`：相關成員請假日 → calcMonthStats
- [x] 4.8 `app/api/cron/daily-digest/route.ts`：全員請假日 → calcMonthStats（門檻風險 pace）
- [x] 4.9 `app/api/line/webhook/route.ts`：查詢者請假日 → calcMonthStats + isDawnKing（我的狀態/排行/破曉王）
- [x] 4.10 `lib/daily-status.ts`：buildDailySnapshot / 門檻風險 pace 傳入請假日
- [x] 4.11 `lib/partner-achievements.ts`：若用 calcMonthStats 分母則補傳
- [ ] 4.12 驗「同一人多頁達成率一致」（分母全部扣對）

## 5. 月結（lib/settlement.ts）

- [x] 5.1 settlement 撈該月 leave_records → 傳入 calcMonthStats（達成率/達標/罰款分母扣請假）
- [x] 5.2 expectedCheckinDays/isDawnKing 亦傳入請假日
- [ ] 5.3 確認重跑同月結果一致（leave_records 持久化 → 可重現）

## 6. 請假 API（app/api/checkin/leave/route.ts）

- [x] 6.1 `POST`：驗 date≥今日邏輯日、所屬月≥當前月且未月結、reason 屬 active 事由；upsert leave_records
- [x] 6.2 `DELETE`：僅 date≥今日可取消；移除 leave_records（恢復分母）
- [x] 6.3 rate limit + 事由存 label 快照

## 7. 事由後台（API + UI）

- [x] 7.1 `app/api/admin/leave-reasons/route.ts`：requireAdmin；GET 清單、POST 新增、PATCH/DELETE 停用
- [x] 7.2 後台事由管理 UI（列表 + 新增/停用）
- [x] 7.3 學員請假時 GET active 事由清單

## 8. 打卡頁請假入口（app/(main)/checkin/page.tsx）

- [x] 8.1 加「今日請假」入口：下拉選事由 → 送出 POST
- [x] 8.2 已請假當日：顯請假狀態（事由），不催打卡；提供取消
- [x] 8.3 事由清單為空 → 提示「暫無可選事由」

## 9. 驗證

- [x] 9.1 `npx tsc --noEmit` + `npm run lint` 通過
- [x] 9.2 `openspec validate add-leave-request --strict` 通過
- [x] 9.3 分母單元驗證：9 月 30 天、請 1 天 → 分母 29×8；請 3 天 → 27×8；leaveDates 空 → 等同現況；expectedCheckinDays 同步
- [x] 9.4 濫用防守：請過去日拒絕、請已月結月拒絕、取消過去日拒絕
- [ ] 9.5 一致性：同一人 dashboard/progress/leaderboard/LINE 達成率一致（分母全扣對）
- [x] 9.6 月結：撈請假算分母、重跑一致
- [ ] 9.7 手動（部署+migration+建事由後）：打卡頁請今日假 → 達成率分母 −1、日曆/儀表板反映；取消恢復
