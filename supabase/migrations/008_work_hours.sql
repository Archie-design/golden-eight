-- 008: 工作時數欄位 + 台灣假日表 + 月結補扣欄位
-- Apply to existing DB via Supabase SQL Editor

ALTER TABLE checkin_records
  ADD COLUMN IF NOT EXISTS work_hours NUMERIC(4,1);

ALTER TABLE monthly_summary
  ADD COLUMN IF NOT EXISTS work_hours_deduction INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS taiwan_holidays (
  date DATE PRIMARY KEY,
  note TEXT
);
ALTER TABLE taiwan_holidays ENABLE ROW LEVEL SECURITY;

-- 預填 2026 剩餘假日（管理員可直接在 Supabase 維護此表）
INSERT INTO taiwan_holidays (date, note) VALUES
  ('2026-06-19', '端午節'),
  ('2026-09-25', '中秋節'),
  ('2026-10-09', '國慶日補假'),
  ('2026-10-10', '國慶日')
ON CONFLICT DO NOTHING;
