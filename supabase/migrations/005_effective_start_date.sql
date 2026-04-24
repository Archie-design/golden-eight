-- ============================================================
-- 計分起算日（effective_start_date）
-- 規則：中午 12:00 前加入 → 加入日 +1；中午 12:00 後加入 → 加入日 +2
-- 既有會員保持 NULL，scoring 層 fallback 到 join_date（維持歷史行為）。
-- ============================================================

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS effective_start_date DATE;
