-- 日出照：checkin_records 加 sunrise_photo_path（Storage path，nullable）
-- 對應 public bucket sunrise-photos 內的物件 path，格式 {ym}/{date}_{memberId}.jpg
-- 一日一張（member_id, date 已 UNIQUE），重傳覆蓋。三個月後由 cron 清理並清空此欄。

ALTER TABLE checkin_records
  ADD COLUMN IF NOT EXISTS sunrise_photo_path TEXT;
