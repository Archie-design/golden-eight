-- daily_status_snapshot 新增 is_leave 欄位：中午推播的「漏卡」判定目前沒有排除請假者，
-- 請假者的 missed/miss_streak 需要比照「如同該日不存在」原則處理，
-- is_leave 作為當下事實快照的一部分一併持久化（不因請假紀錄事後變動而重算）。

ALTER TABLE daily_status_snapshot
  ADD COLUMN IF NOT EXISTS is_leave BOOLEAN NOT NULL DEFAULT FALSE;
