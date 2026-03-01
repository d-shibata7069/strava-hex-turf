-- 退会時の振る舞い: tiles は「空き地」として残す（ON DELETE SET NULL）、
-- その他ユーザー関連テーブルは退会と同時に削除（ON DELETE CASCADE）。
-- 既存制約を DROP してから追加し直す。

-- =============================================================
-- tiles: owner_id を ON DELETE SET NULL に変更（退会ユーザーの陣地は空き地に）
-- =============================================================
ALTER TABLE tiles
  DROP CONSTRAINT IF EXISTS tiles_owner_id_fkey;

ALTER TABLE tiles
  ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE tiles
  ADD CONSTRAINT tiles_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- =============================================================
-- group_members: user_id を ON DELETE CASCADE に（既に CASCADE の場合は冪等のため再追加）
-- =============================================================
ALTER TABLE group_members
  DROP CONSTRAINT IF EXISTS group_members_user_id_fkey;

ALTER TABLE group_members
  ADD CONSTRAINT group_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================
-- activity_logs: user_id を ON DELETE CASCADE に
-- =============================================================
ALTER TABLE activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;

ALTER TABLE activity_logs
  ADD CONSTRAINT activity_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================
-- user_group_daily_stats: user_id を ON DELETE CASCADE に
-- =============================================================
ALTER TABLE user_group_daily_stats
  DROP CONSTRAINT IF EXISTS user_group_daily_stats_user_id_fkey;

ALTER TABLE user_group_daily_stats
  ADD CONSTRAINT user_group_daily_stats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================
-- activity_tiles: user_id を ON DELETE CASCADE に
-- =============================================================
ALTER TABLE activity_tiles
  DROP CONSTRAINT IF EXISTS activity_tiles_user_id_fkey;

ALTER TABLE activity_tiles
  ADD CONSTRAINT activity_tiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
