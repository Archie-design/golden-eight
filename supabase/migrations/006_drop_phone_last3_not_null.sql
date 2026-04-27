-- ============================================================
-- 解除 phone_last3 的 NOT NULL 約束
-- 該欄位早已棄用（新資料以 phone_hash 比對；舊資料漸進遷移），
-- schema.sql 也標示為可空，但 production DB 仍保留 NOT NULL，
-- 導致註冊/新增會員時違反約束（PostgreSQL 23502）。
-- ============================================================

ALTER TABLE members
  ALTER COLUMN phone_last3 DROP NOT NULL;
