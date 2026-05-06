-- 早睡早起三段式評分：新增 early_sleep_half 欄位並將 base_score 改為 NUMERIC
ALTER TABLE checkin_records
  ADD COLUMN IF NOT EXISTS early_sleep_half BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE checkin_records
  ALTER COLUMN base_score TYPE NUMERIC(3,1);
