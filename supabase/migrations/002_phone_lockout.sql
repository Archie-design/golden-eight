-- ============================================================
-- 強化登入安全：完整手機號 + 失敗鎖定
-- ============================================================

-- 1. 新欄位
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS phone_full      TEXT,
  ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until    TIMESTAMPTZ;

-- 2. phone_full 唯一索引（部分索引：只約束已填值者，方便舊資料漸進遷移）
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone_full
  ON members(phone_full)
  WHERE phone_full IS NOT NULL;

-- 3. 會員 ID 序列（原先用 count+1 會 race）
CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1000;

-- 4. DB function：回傳下一個格式化的會員 ID（M + 3 位數字，超過 999 自動擴展位數）
CREATE OR REPLACE FUNCTION next_member_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('member_id_seq');
  RETURN 'M' || LPAD(n::TEXT, 3, '0');
END;
$$;

-- 5. 若 sequence 尚未對齊現有資料，補齊起始值
--    用純 SQL + HAVING 代替 DO block，避開 Supabase SQL 編輯器對 dollar-quote 的解析問題。
--    沒有符合的舊會員時，HAVING 過濾掉整列，setval 不會被呼叫，sequence 維持 START 1000。
SELECT setval('member_id_seq', MAX(SUBSTRING(id FROM 2)::INT))
  FROM members
 WHERE id ~ '^M[0-9]+$'
HAVING MAX(SUBSTRING(id FROM 2)::INT) > 0;

-- 6. 補齊遺漏的索引（年月查詢、成就統計、LINE 登入）
CREATE INDEX IF NOT EXISTS idx_monthly_ym ON monthly_summary(year_month);
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_members_line ON members(line_user_id) WHERE line_user_id IS NOT NULL;

-- 7. schedule_template：tag_name 與 tag_id 欄位已由 block_tags JSONB 取代，直接移除
ALTER TABLE schedule_template DROP COLUMN IF EXISTS tag_name;
ALTER TABLE schedule_template DROP COLUMN IF EXISTS tag_id;
