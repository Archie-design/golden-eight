-- 夥伴系統：邀請關係與鼓勵互動
-- 設計參考：openspec/changes/partner-system/design.md

-- 1. 夥伴關係（單向記錄，狀態 pending / accepted / rejected）
CREATE TABLE IF NOT EXISTS partner_requests (
  id            BIGSERIAL PRIMARY KEY,
  requester_id  TEXT NOT NULL REFERENCES members(id),
  target_id     TEXT NOT NULL REFERENCES members(id),
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,
  CHECK (requester_id <> target_id),
  UNIQUE (requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_requests_requester
  ON partner_requests(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_requests_target
  ON partner_requests(target_id, status);

-- 2. 鼓勵紀錄（每對成員每日一次）
CREATE TABLE IF NOT EXISTS encouragements (
  id          BIGSERIAL PRIMARY KEY,
  from_id     TEXT NOT NULL REFERENCES members(id),
  to_id       TEXT NOT NULL REFERENCES members(id),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_id <> to_id),
  UNIQUE (from_id, to_id, date)
);

CREATE INDEX IF NOT EXISTS idx_encouragements_to
  ON encouragements(to_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_encouragements_from
  ON encouragements(from_id);

-- 3. RLS（service_role 自動繞過，前端透過 server-side API）
ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE encouragements   ENABLE ROW LEVEL SECURITY;
