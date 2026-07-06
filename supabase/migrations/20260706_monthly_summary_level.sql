-- monthly_summary.level：記錄月結當下成員「當月生效」的階梯快照。
-- 目的：讓歷史月份的罰金/門檻/顯示以「當月實際階梯」為準，
--       不再受成員之後升降階（members.level 變動）污染，且歷史重跑可重現。
-- 允許 NULL：既有列在本欄新增前無正確歷史值，交由 backfill 腳本補齊。
ALTER TABLE monthly_summary
  ADD COLUMN IF NOT EXISTS level TEXT;
