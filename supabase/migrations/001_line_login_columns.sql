-- Migration 001: Add LINE Login columns to members table
-- Run in Supabase Dashboard > SQL Editor

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS line_user_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS line_display_name  TEXT,
  ADD COLUMN IF NOT EXISTS line_picture_url   TEXT;
