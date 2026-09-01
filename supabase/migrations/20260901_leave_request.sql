-- 請假功能：leave_records（每日一筆請假）+ leave_reasons（後台事由清單）
-- 請假日從計分分母移除（分子分母皆移）。一日一筆（UNIQUE(member_id,date)）。
-- reason 存 label 文字快照，避免事由清單日後改動影響歷史紀錄。

CREATE TABLE IF NOT EXISTS leave_reasons (
  id          BIGSERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_records (
  id          BIGSERIAL PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES members(id),
  date        DATE NOT NULL,                    -- 邏輯日（與 checkin_records.date 同語意）
  reason      TEXT NOT NULL,                    -- 事由 label 快照
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, date)
);

CREATE INDEX IF NOT EXISTS idx_leave_records_member_date
  ON leave_records(member_id, date);

ALTER TABLE leave_reasons  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_records  ENABLE ROW LEVEL SECURITY;
