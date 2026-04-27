-- ============================================================
-- 打卡編輯紀錄（audit log）
-- 用途：成員修正當日打卡時保留前後快照與成就增減，便於管理員查核「誤觸」案例。
-- ============================================================

CREATE TABLE IF NOT EXISTS checkin_edit_logs (
  id                   BIGSERIAL PRIMARY KEY,
  member_id            TEXT NOT NULL REFERENCES members(id),
  date                 DATE NOT NULL,                 -- 被編輯的打卡邏輯日
  before_tasks         BOOLEAN[] NOT NULL,            -- 編輯前 8 個任務狀態
  after_tasks          BOOLEAN[] NOT NULL,            -- 編輯後 8 個任務狀態
  before_score         NUMERIC(3,1) NOT NULL,
  after_score          NUMERIC(3,1) NOT NULL,
  achievements_added   TEXT[] NOT NULL DEFAULT '{}',  -- 編輯後新解鎖的成就 code
  achievements_removed TEXT[] NOT NULL DEFAULT '{}',  -- 編輯後撤銷的成就 code
  edited_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkin_edit_logs_member_date
  ON checkin_edit_logs(member_id, date);

ALTER TABLE checkin_edit_logs ENABLE ROW LEVEL SECURITY;
-- 不新增 policy = 預設全部拒絕（service_role bypass）
