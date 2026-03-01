-- タイルを通過した日時を保持し、tiles.last_updated_at の基準を「通過日」にするため。
-- 既存行は DEFAULT で now() が入る。

ALTER TABLE activity_tiles
  ADD COLUMN IF NOT EXISTS passed_through_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN activity_tiles.passed_through_at IS
  'そのアクティビティでタイルを通過した日時（Strava の start_date）。tiles の last_updated_at に使用。';
