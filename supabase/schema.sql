-- ============================================================
-- 黃金八套餐定課系統 — Supabase Schema
-- 執行方式：在 Supabase Dashboard > SQL Editor 貼上並執行
-- ============================================================

-- 1. 成員表
CREATE TABLE IF NOT EXISTS members (
  id            TEXT PRIMARY KEY,               -- M001, M002...
  name          TEXT NOT NULL,
  phone_last3   TEXT NOT NULL,
  join_date     DATE NOT NULL,
  level         TEXT NOT NULL DEFAULT '黃金戰士',  -- 黃金戰士 / 白銀戰士 / 青銅戰士
  next_level    TEXT,
  is_admin      BOOLEAN DEFAULT FALSE,
  status        TEXT DEFAULT '活躍',             -- 活躍 / 停用
  line_user_id  TEXT,                            -- 預留 LINE OAuth
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, phone_last3)
);

-- 2. 打卡紀錄表
CREATE TABLE IF NOT EXISTS checkin_records (
  id            BIGSERIAL PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members(id),
  date          DATE NOT NULL,
  tasks         BOOLEAN[] NOT NULL,              -- 長度 8，對應八項任務
  base_score    INT NOT NULL,                    -- 0-8
  punch_bonus   NUMERIC(3,1) DEFAULT 0,          -- 0 or 0.5
  total_score   NUMERIC(4,1) NOT NULL,           -- 0-8.5
  note          TEXT,
  submit_time   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, date)
);

-- 3. 月結摘要表
CREATE TABLE IF NOT EXISTS monthly_summary (
  id            BIGSERIAL PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members(id),
  year_month    TEXT NOT NULL,                   -- '2026-04'
  total_score   NUMERIC(8,2) DEFAULT 0,
  max_score     NUMERIC(8,2) DEFAULT 0,
  rate          NUMERIC(5,2) DEFAULT 0,          -- 百分比，如 72.50
  passing       BOOLEAN DEFAULT FALSE,
  penalty       INT DEFAULT 0,                   -- NT$
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
  id            TEXT PRIMARY KEY,               -- T001...
  member_id     TEXT REFERENCES members(id),    -- NULL = 系統標籤
  tag_name      TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#4A90D9',
  emoji         TEXT,
  is_system     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 行程模板表
CREATE TABLE IF NOT EXISTS schedule_template (
  id            BIGSERIAL PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members(id),
  tag_id        TEXT REFERENCES tag_library(id),
  tag_name      TEXT NOT NULL,
  start_time    TEXT NOT NULL,                  -- 'HH:MM'
  end_time      TEXT NOT NULL,
  note          TEXT,
  is_public     BOOLEAN DEFAULT FALSE,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

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
-- 索引（加速常用查詢）
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_checkin_member_date ON checkin_records(member_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_date ON checkin_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_member ON monthly_summary(member_id, year_month DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_member ON achievements(member_id);
CREATE INDEX IF NOT EXISTS idx_schedule_member ON schedule_template(member_id);
CREATE INDEX IF NOT EXISTS idx_tag_member ON tag_library(member_id);
