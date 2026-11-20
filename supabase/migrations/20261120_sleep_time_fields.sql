-- split-dawn-punch-sleep-scoring：早睡早起改為「入睡時間 23:00 前」+「睡滿 6 小時」雙條件判定，
-- 需要使用者填入睡/起床時間才能換算睡眠時數。early_sleep_half 欄位保留供歷史資料相容，不刪除。

ALTER TABLE checkin_records
  ADD COLUMN IF NOT EXISTS sleep_start TEXT,   -- 入睡時間 HH:MM（勾選早睡早起時填寫）
  ADD COLUMN IF NOT EXISTS sleep_end   TEXT;   -- 起床時間 HH:MM（勾選早睡早起時填寫）

COMMENT ON COLUMN checkin_records.early_sleep_half IS '已停用（split-dawn-punch-sleep-scoring 後不再寫入），保留供歷史資料相容';
COMMENT ON COLUMN checkin_records.sleep_start IS 'task 1 入睡時間 HH:MM（勾選早睡早起時填寫）';
COMMENT ON COLUMN checkin_records.sleep_end   IS 'task 1 起床時間 HH:MM（勾選早睡早起時填寫）';
