-- Migration 004: 新增密碼欄位
-- 執行環境：Supabase SQL Editor

ALTER TABLE members ADD COLUMN IF NOT EXISTS password_hash TEXT;
