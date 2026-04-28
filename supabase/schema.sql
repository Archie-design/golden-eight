-- ============================================================
-- 黃金八套餐定課系統 — Supabase Schema（當前真相）
-- 新環境 bootstrap：執行此檔即可；既有環境依序套用 migrations/*.sql
-- 最後更新：2026-04-24
-- ============================================================

-- 1. 成員表
CREATE TABLE IF NOT EXISTS members (
  id              TEXT PRIMARY KEY,                 -- M001, M002...
  name            TEXT NOT NULL,
  phone_last3     TEXT,                              -- 已棄用（舊資料相容；新資料請用 phone_hash）
  phone_full      TEXT,                              -- 10 位手機號，server-side only
  phone_hash      TEXT,                              -- HMAC(phone) server-side only
  password_hash   TEXT,                              -- scrypt(password, salt)，server-side only
  failed_attempts INT  NOT NULL DEFAULT 0,           -- 登入失敗計數
  locked_until    TIMESTAMPTZ,                       -- 鎖定截止時間
  token_version   INT  NOT NULL DEFAULT 0,           -- JWT 撤銷版本號
  join_date       DATE NOT NULL,
  effective_start_date DATE,                         -- 起算計分日（12:00 前加入 +1，12:00 後 +2；NULL = fallback 至 join_date）
  level           TEXT NOT NULL DEFAULT '黃金戰士',
  next_level      TEXT,
  is_admin        BOOLEAN DEFAULT FALSE,
  status          TEXT DEFAULT '活躍',
  line_user_id       TEXT,
  line_display_name  TEXT,
  line_picture_url   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- phone_hash / phone_full / line_user_id 唯一（部分索引便於漸進遷移）
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone_hash
  ON members(phone_hash) WHERE phone_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone_full
  ON members(phone_full) WHERE phone_full IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_line_user
  ON members(line_user_id) WHERE line_user_id IS NOT NULL;

-- 1b. 打卡編輯紀錄（誤觸修正稽核）
CREATE TABLE IF NOT EXISTS checkin_edit_logs (
  id                   BIGSERIAL PRIMARY KEY,
  member_id            TEXT NOT NULL REFERENCES members(id),
  date                 DATE NOT NULL,
  before_tasks         BOOLEAN[] NOT NULL,
  after_tasks          BOOLEAN[] NOT NULL,
  before_score         NUMERIC(3,1) NOT NULL,
  after_score          NUMERIC(3,1) NOT NULL,
  achievements_added   TEXT[] NOT NULL DEFAULT '{}',
  achievements_removed TEXT[] NOT NULL DEFAULT '{}',
  edited_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checkin_edit_logs_member_date
  ON checkin_edit_logs(member_id, date);

-- 2. 打卡紀錄表
CREATE TABLE IF NOT EXISTS checkin_records (
  id            BIGSERIAL PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members(id),
  date          DATE NOT NULL,
  tasks         BOOLEAN[] NOT NULL,              -- 長度 8
  base_score    INT NOT NULL,
  punch_bonus   NUMERIC(3,1) DEFAULT 0,          -- 目前固定 0（加分邏輯暫停）
  total_score   NUMERIC(4,1) NOT NULL,
  punch_streak  INT NOT NULL DEFAULT 0,
  note          TEXT,
  submit_time   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, date)
);

-- 3. 月結摘要表
CREATE TABLE IF NOT EXISTS monthly_summary (
  id            BIGSERIAL PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members(id),
  year_month    TEXT NOT NULL,                   -- 'YYYY-MM'
  total_score   NUMERIC(8,2) DEFAULT 0,
  max_score     NUMERIC(8,2) DEFAULT 0,
  rate          NUMERIC(5,2) DEFAULT 0,
  passing       BOOLEAN DEFAULT FALSE,
  penalty       INT DEFAULT 0,
  max_streak    INT DEFAULT 0,
  is_dawn_king  BOOLEAN DEFAULT FALSE,
  settled_at    TIMESTAMPTZ,
  UNIQUE(member_id, year_month)
);

-- 4. 成就表
CREATE TABLE IF NOT EXISTS achievements (
  id            BIGSERIAL PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members(id),
  code          TEXT NOT NULL,
  unlocked_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, code)
);

-- 5. 標籤庫表
CREATE TABLE IF NOT EXISTS tag_library (
  id            TEXT PRIMARY KEY,
  member_id     TEXT REFERENCES members(id),
  tag_name      TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#4A90D9',
  emoji         TEXT,
  is_system     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 行程模板表（block_tags JSONB 取代舊 tag_id / tag_name）
CREATE TABLE IF NOT EXISTS schedule_template (
  id            BIGSERIAL PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members(id),
  start_time    TEXT NOT NULL,                  -- 'HH:MM'
  end_time      TEXT NOT NULL,
  block_tags    JSONB NOT NULL DEFAULT '[]',    -- [{id,name,color,emoji}]
  note          TEXT,
  is_public     BOOLEAN DEFAULT FALSE,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 日出快取表
CREATE TABLE IF NOT EXISTS sunrise_cache (
  date       DATE PRIMARY KEY,
  sunrise    TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 會員 ID 序列 + next_member_id() RPC
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1000;

CREATE OR REPLACE FUNCTION next_member_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $fn$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('member_id_seq');
  RETURN 'M' || LPAD(n::TEXT, 3, '0');
END;
$fn$;

-- 若既有資料存在，對齊 sequence 起始值
SELECT setval('member_id_seq', MAX(SUBSTRING(id FROM 2)::INT))
  FROM members
 WHERE id ~ '^M[0-9]+$'
HAVING MAX(SUBSTRING(id FROM 2)::INT) > 0;

-- ============================================================
-- 排程模板原子替換 RPC（審查報告 P0-2）
-- ============================================================

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

-- ============================================================
-- 標籤移除 RPC（審查報告 P2-16）
-- ============================================================

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

-- ============================================================
-- 系統預設標籤（14 個）
-- ============================================================

INSERT INTO tag_library (id, member_id, tag_name, color, emoji, is_system) VALUES
  ('T001', NULL, '早睡早起',     '#6C5CE7', '🌙', TRUE),
  ('T002', NULL, '破曉打拳',     '#E17055', '🥊', TRUE),
  ('T003', NULL, '丹氣跑步',     '#00B894', '🏃', TRUE),
  ('T004', NULL, '曬太陽',       '#FDCB6E', '☀️', TRUE),
  ('T005', NULL, '工作8小時',    '#0984E3', '💼', TRUE),
  ('T006', NULL, '不吃肉',       '#00CEC9', '🥗', TRUE),
  ('T007', NULL, '寫觀心書',     '#A29BFE', '📖', TRUE),
  ('T008', NULL, '淨心功法',     '#55EFC4', '🧘', TRUE),
  ('T009', NULL, '起床',         '#FAB1A0', '🌅', TRUE),
  ('T010', NULL, '刷牙洗臉',     '#74B9FF', '🪥', TRUE),
  ('T011', NULL, '早餐',         '#FD79A8', '🍳', TRUE),
  ('T012', NULL, '午餐',         '#FFEAA7', '🍱', TRUE),
  ('T013', NULL, '晚餐',         '#DFE6E9', '🍜', TRUE),
  ('T014', NULL, '休息',         '#B2BEC3', '😴', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 索引
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_checkin_member_date ON checkin_records(member_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_date        ON checkin_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_member      ON monthly_summary(member_id, year_month DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_ym          ON monthly_summary(year_month);
CREATE INDEX IF NOT EXISTS idx_achievements_member ON achievements(member_id);
CREATE INDEX IF NOT EXISTS idx_achievements_code   ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_schedule_member     ON schedule_template(member_id);
CREATE INDEX IF NOT EXISTS idx_tag_member          ON tag_library(member_id);
CREATE INDEX IF NOT EXISTS idx_members_status_active
  ON members(status) WHERE status = '活躍';

-- ============================================================
-- Row Level Security（審查報告 P1-8）
-- 伺服端以 service_role key 呼叫，自動繞過 RLS；此層阻擋 anon key 濫用。
-- ============================================================

ALTER TABLE members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summary    ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_library        ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_template  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sunrise_cache      ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_edit_logs  ENABLE ROW LEVEL SECURITY;
