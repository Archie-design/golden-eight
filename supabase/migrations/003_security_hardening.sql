-- ============================================================
-- 安全/可靠性強化（審查報告 P0-2、P0-3、P1-7、P1-8、P2-14、P2-16、P3-19 相關）
-- ============================================================

-- 1. LINE userId 唯一索引（P0-3）
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_line_user
  ON members(line_user_id)
  WHERE line_user_id IS NOT NULL;

-- 2. 手機 hash 欄位（P1-8）— 伺服端以 HMAC-SHA256 寫入；舊資料在登入時漸進遷移
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS phone_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone_hash
  ON members(phone_hash)
  WHERE phone_hash IS NOT NULL;

-- 3. JWT token_version（P2-14）— 每位成員的 token 版本；遞增即撤銷所有既有 token
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;

-- 4. 日出快取表（P1-7）— 跨 instance 持久化，避免重打外部 API
CREATE TABLE IF NOT EXISTS sunrise_cache (
  date     DATE PRIMARY KEY,
  sunrise  TEXT NOT NULL,           -- 'HH:MM' 台北時間
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 排程模板「原子替換」RPC（P0-2）— delete + insert 放在同一 transaction 內
CREATE OR REPLACE FUNCTION replace_schedule_template(
  p_member_id TEXT,
  p_is_public BOOLEAN,
  p_blocks    JSONB
) RETURNS VOID
LANGUAGE plpgsql
AS $fn$
BEGIN
  DELETE FROM schedule_template WHERE member_id = p_member_id;

  IF p_blocks IS NOT NULL AND jsonb_array_length(p_blocks) > 0 THEN
    INSERT INTO schedule_template (member_id, start_time, end_time, block_tags, is_public, updated_at)
    SELECT
      p_member_id,
      b ->> 'startTime',
      b ->> 'endTime',
      COALESCE(b -> 'tags', '[]'::jsonb),
      p_is_public,
      NOW()
    FROM jsonb_array_elements(p_blocks) AS b;
  END IF;
END;
$fn$;

-- 6. 標籤一次性移除 RPC（P2-16）— 避免 app 層 N+1 update
CREATE OR REPLACE FUNCTION remove_tag_from_templates(
  p_member_id TEXT,
  p_tag_id    TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $fn$
BEGIN
  UPDATE schedule_template
     SET block_tags = COALESCE((
       SELECT jsonb_agg(t)
         FROM jsonb_array_elements(block_tags) AS t
        WHERE t ->> 'id' IS DISTINCT FROM p_tag_id
     ), '[]'::jsonb)
   WHERE member_id = p_member_id;
END;
$fn$;

-- 7. 啟用 RLS（P1-8）— 伺服端以 service_role key 操作（自動繞過 RLS），
--    但萬一 anon key 被濫用，此層阻止所有讀寫。
ALTER TABLE members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summary    ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_library        ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_template  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sunrise_cache      ENABLE ROW LEVEL SECURITY;

-- 不新增 policy = 預設全部拒絕（只有 service_role 可通過）。
