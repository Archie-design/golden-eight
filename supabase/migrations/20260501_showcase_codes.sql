-- 用戶自選 3 顆展示徽章（顯示在排行榜）
-- 陣列順序 = 顯示順序；CHECK 防止超過 3 顆
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS showcase_codes TEXT[] NOT NULL DEFAULT '{}';

-- 重複跑 migration 安全：先嘗試移除舊 constraint 再加
ALTER TABLE members DROP CONSTRAINT IF EXISTS showcase_codes_max_3;
ALTER TABLE members ADD CONSTRAINT showcase_codes_max_3
  CHECK (array_length(showcase_codes, 1) IS NULL OR array_length(showcase_codes, 1) <= 3);
