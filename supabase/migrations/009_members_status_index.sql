-- ============================================================
-- 部分索引：members.status = '活躍'
--
-- 全站 8+ 處查詢以 status = '活躍' 過濾（settlement / progress /
-- leaderboard / cron / admin / api-helper 等）。新增部分索引讓
-- planner 直接命中索引，不需序列掃描整張 members 表。
--
-- 採部分索引（partial index）：只索引 '活躍' 列，索引體積最小、
-- 對 INSERT/UPDATE 額外負擔也最低。
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_members_status_active
  ON members(status) WHERE status = '活躍';
