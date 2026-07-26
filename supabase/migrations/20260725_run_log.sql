-- 丹氣慢跑記錄：checkin_records 加 run_minutes（分鐘，整數）與 run_km（公里，2 位小數）
-- 皆選填、各自獨立；純記錄，不影響 tasks[2] 完成判定與計分。一日一筆（隨當日打卡）。

ALTER TABLE checkin_records
  ADD COLUMN IF NOT EXISTS run_minutes INT,
  ADD COLUMN IF NOT EXISTS run_km      NUMERIC(6,2);
