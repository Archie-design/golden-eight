## 1. 資料庫遷移

- [ ] 1.1 建立 `supabase/migrations/20260430_partners.sql`（`partner_requests` 表 + 索引）
- [ ] 1.2 在遷移檔新增 `encouragements` 表 + 索引
- [ ] 1.3 更新 `supabase/schema.sql` 補充兩張新表定義
- [ ] 1.4 在 Supabase SQL Editor 執行遷移，確認兩表建立成功

## 2. 型別與常數

- [ ] 2.1 在 `types/index.ts` 新增 `PartnerCard` 介面
- [ ] 2.2 在 `types/index.ts` 新增 `PartnerInvitation` 介面
- [ ] 2.3 在 `lib/constants.ts` 新增 9 個夥伴成就（PARTNER_FIRST、PARTNER_3、PARTNER_5、PARTNER_BEAT_RATE、PARTNER_BEAT_STREAK、PARTNER_SYNC_7、PARTNER_SYNC_30、PARTNER_CHEER_10、PARTNER_CHEERED_10）
- [ ] 2.4 確認 `Handshake` 圖示是否在 lucide-react 中；若有則加入 `lib/icons.tsx`，若無則改用替代圖示

## 3. 核心邏輯

- [ ] 3.1 在 `lib/scoring.ts` 新增 `calcPartnerSyncStreak(myDates, partnerDates, endDate, windowDays)` 純函式
- [ ] 3.2 手動驗證 `calcPartnerSyncStreak` 邏輯正確（邊界：連續中斷、空集合、起始日）

## 4. API Routes — 夥伴管理

- [ ] 4.1 建立 `app/api/partners/route.ts`（GET：取夥伴清單 + 今日快照，批次查詢）
- [ ] 4.2 建立 `app/api/partners/search/route.ts`（GET：依姓名搜尋，排除自己與現有夥伴）
- [ ] 4.3 建立 `app/api/partners/invite/route.ts`（POST：送出邀請，含上限/重複/反向邀請檢查）
- [ ] 4.4 建立 `app/api/partners/invitations/route.ts`（GET：取 sent + received 待處理邀請）
- [ ] 4.5 建立 `app/api/partners/invitations/[id]/route.ts`（PATCH：accept/reject，含夥伴數上限檢查）
- [ ] 4.6 建立 `app/api/partners/[id]/route.ts`（DELETE：解除夥伴關係，驗證操作者是關係成員）
- [ ] 4.7 建立 `app/api/partners/[id]/encourage/route.ts`（POST：送出鼓勵，含夥伴關係驗證）

## 5. API Routes — 整合修改

- [ ] 5.1 修改 `app/api/checkin/submit/route.ts`：打卡成功後查詢夥伴，觸發競爭/同步類成就
- [ ] 5.2 修改 `app/api/stats/dashboard/route.ts`：加入夥伴快照（最多 3 筆精簡卡）

## 6. 前端頁面

- [ ] 6.1 建立 `app/(main)/partners/page.tsx`（三分頁架構：我的夥伴 / 邀請管理 / 尋找夥伴）
- [ ] 6.2 實作「我的夥伴」分頁：PartnerCard 列表（頭像縮寫、打卡 badge、達成率進度條、任務 8 格、鼓勵按鈕）
- [ ] 6.3 實作「邀請管理」分頁：收到的邀請（接受/拒絕）+ 我送出的邀請（取消）
- [ ] 6.4 實作「尋找夥伴」分頁：搜尋框 + 成員清單 + 送出邀請按鈕
- [ ] 6.5 修改 `app/(main)/dashboard/page.tsx`：新增「夥伴動態」區塊（最多 3 筆精簡卡 + 「查看全部」連結 + 無夥伴時引導卡片）
- [ ] 6.6 修改 `components/Navbar.tsx`：新增「夥伴」項目（`Users` 圖示，連結 `/partners`）

## 7. 驗收

- [ ] 7.1 執行 `npx tsc --noEmit` 確認零型別錯誤
- [ ] 7.2 測試邀請流程：A 邀請 B → B 接受 → 雙方清單出現對方
- [ ] 7.3 測試重複邀請保護：重複邀請回 409；反向邀請提示接受
- [ ] 7.4 測試夥伴卡片：B 打卡後 A 刷新 → 顯示今日已打卡 + 任務
- [ ] 7.5 測試鼓勵：送出後按鈕 disabled；同日再點被阻止
- [ ] 7.6 測試解除關係：雙方清單同步移除
- [ ] 7.7 測試成就觸發：接受第一位夥伴解鎖「初結夥伴」；打卡後 streak 超越夥伴解鎖「連續超越」
