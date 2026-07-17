## 1. 資料層

- [x] 1.1 新增 migration `supabase/migrations/<YYYYMMDD>_daily_status_snapshot.sql`：建 `daily_status_snapshot`（`date DATE`, `member_id TEXT REFERENCES members(id)`, `missed BOOLEAN NOT NULL`, `miss_streak INT NOT NULL DEFAULT 0`, `rate NUMERIC(5,2)`, `passing BOOLEAN`, `pushed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `UNIQUE(date, member_id)`）+ 索引 `(date)`、`(member_id, date DESC)`；啟用 RLS（比照其他表，service_role 自動繞過）
- [x] 1.2 同步更新 `supabase/schema.sql`（新環境 bootstrap 的真相來源）
- [x] 1.3 於 Supabase SQL Editor 對正式 DB 套用 migration（PostgREST 無法執行 DDL，需人工執行）

## 2. 核心邏輯（純函式，與 I/O 分離）

- [x] 2.1 於 `lib/constants.ts` 新增 `LONG_ABSENCE_DAYS = 7`
- [x] 2.2 新增 `lib/daily-status.ts`：`buildDailySnapshot(members, recordsByMember, prevSnapshotByMember, targetDate)` → 每位成員的 `{missed, miss_streak, rate, passing}`；MUST 依 `effective_start_date ?? join_date` 排除起算日未到者；`rate`/`passing` 由 `calcMonthStats` + 階梯門檻求得
- [x] 2.3 於同檔新增 `diffStatusEvents(prevByMember, currByMember)` → 變化事件清單（開始缺卡／回歸／跌破門檻／回到門檻／轉入長期缺席）；`miss_streak` 純累進 MUST NOT 產生事件；`prev` 為空（首日）MUST 回傳空事件陣列
- [x] 2.4 於同檔新增 `formatDigestMessage(snapshot, events, targetDate)` → LINE 純文字摘要；長期缺席者（`miss_streak >= LONG_ABSENCE_DAYS`）MUST 從漏卡/風險名單移除並摺疊為單行；MUST NOT 排除管理員自身

## 3. LINE 推播

- [x] 3.1 新增 `lib/line-push.ts`：`pushTextToUsers(userIds, text)` 呼叫 Messaging API `POST https://api.line.me/v2/bot/message/push`，使用 `LINE_CHANNEL_ACCESS_TOKEN`；個別收件人失敗 MUST 隔離（記 log、不中斷其他人、不拋出）
- [x] 3.2 於 `.env.local` 與部署環境設定 `LINE_CHANNEL_ACCESS_TOKEN`；更新 `CLAUDE.md` 環境變數表（註明與 Login channel 的 ID/SECRET 用途不同）

## 4. Cron 路由

- [x] 4.1 新增 `app/api/cron/daily-digest/route.ts`：驗 `Bearer CRON_SECRET`（否則 401）→ 計算 `D = getCheckinDayTaipei() 的前一日` → 撈活躍成員、D 當月打卡紀錄、`snapshot[D-1]` → `buildDailySnapshot` → **upsert 快照** → `diffStatusEvents` → `formatDigestMessage` → 推播給 `is_admin && status='活躍' && line_user_id` 的成員 → 成功後標記 `pushed_at`
- [x] 4.2 順序 MUST 為「先寫快照、後推播」，且推播失敗不影響已寫入的快照
- [x] 4.3 冪等：快照以 `(date, member_id)` upsert；該日已標記 `pushed_at` 者重跑 MUST NOT 重複推播；快照已寫但 `pushed_at` 未標記者重跑 MUST 補送
- [x] 4.4 於 `vercel.json` 新增排程 `{"path": "/api/cron/daily-digest", "schedule": "30 4 * * *"}`（UTC 04:30 = 台北 12:30）
- [x] 4.5 依 design 決策 6 處置既有 `daily-reminder`：移除 `app/api/cron/daily-reminder/route.ts` 與其 `vercel.json` 排程，避免語意重疊的死碼

## 5. 驗證

- [x] 5.1 `npx tsc --noEmit` 通過
- [x] 5.2 `npm run lint` 通過
- [x] 5.3 邏輯日 off-by-one：以 12:30 情境驗證目標日為「前一日」而非當日（避免全員誤報漏卡）
- [x] 5.4 新進豁免：驗證 `effective_start_date` 晚於目標日的成員不產生快照列、不入摘要（可用 M048 游孟晴 `2026-06-21` 對 `2026-06-20` 驗證）
- [x] 5.5 首日無 `snapshot[D-1]`：驗證不產生任何變化事件、不爆量
- [x] 5.6 長期缺席摺疊：驗證 `miss_streak >= 7` 者不在漏卡/風險明細、僅計入摺疊行（可用 M044 蕭奕薌 6 月資料情境驗證）
- [x] 5.7 冪等：同日連續觸發兩次，確認快照無重複列且僅推播一次
- [ ] 5.8 端到端：以本機 dev server + `CRON_SECRET` 觸發 `/api/cron/daily-digest`，確認 3 位管理員收到 LINE 摘要且內容符合預期
      **⚠️ 受阻（非程式碼問題）**：已實測觸發，快照寫入與失敗隔離均正常，但推播三位管理員全數 `HTTP 400 / profile 404`。
      根因為 LINE userId 是 Provider-scoped——Login channel 發出的 `line_user_id` 對 Bot 所屬 Provider 無效（已加好友重測仍 404，排除未加好友）。
      詳見 design.md「實作發現」。需待另立的 webhook 變更取得正確 userId 後才能完成此驗證；屆時無需改動本變更的程式碼。
