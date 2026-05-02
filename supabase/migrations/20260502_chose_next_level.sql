-- monthly_summary.chose_next_level：月結套用 next_level 之前的快照
-- TRUE = 該月結瞬間 members.next_level 非 NULL（成員已選擇下月階梯）
-- 既有列預設 false（migration 前無此資訊，僅供未來月份使用）

ALTER TABLE monthly_summary
  ADD COLUMN IF NOT EXISTS chose_next_level BOOLEAN NOT NULL DEFAULT FALSE;

-- 索引：未選名單查詢主要 WHERE 條件
CREATE INDEX IF NOT EXISTS idx_monthly_unselected
  ON monthly_summary (year_month) WHERE chose_next_level = FALSE;
