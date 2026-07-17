-- daily_status_snapshot：每日狀態事實快照（每位活躍成員 × 每個邏輯日一列）。
--
-- 目的：
--   1. 供每日摘要比對「昨日 vs 今日」以產生狀態變化事件。
--   2. 留存 rate / passing 的「當下事實」——這些值事後重建不出來（補登、月結、
--      工時修正都會改變歷史分數）。與 monthly_summary.level 同一防污染哲學：
--      歷史以當下記錄為準，不由現況回推。
--   3. pushed_at 供推播冪等與失敗重試。
--
-- 起算日未到的成員不產生列（不是漏卡，是還沒加入）。
CREATE TABLE IF NOT EXISTS daily_status_snapshot (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,                    -- 邏輯日（12:00 為界，非日曆日）
  member_id   TEXT NOT NULL REFERENCES members(id),
  missed      BOOLEAN NOT NULL,                 -- 該邏輯日是否無打卡紀錄
  miss_streak INT NOT NULL DEFAULT 0,           -- 截至該日的連續缺卡天數（有打卡為 0）
  rate        NUMERIC(5,2),                     -- 該日當下的累計月達成率（事實快照，不重算）
  passing     BOOLEAN,                          -- 該日當下是否達其階梯門檻（事實快照）
  pushed_at   TIMESTAMPTZ,                      -- 該日摘要推播完成時間；NULL = 未推播，可重試
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, member_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_status_date        ON daily_status_snapshot(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_status_member_date ON daily_status_snapshot(member_id, date DESC);

ALTER TABLE daily_status_snapshot ENABLE ROW LEVEL SECURITY;
