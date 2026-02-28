-- Webhook処理およびタイルスコア用カラム追加
-- users: Strava API 呼び出し用アクセストークン
ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT;

-- tiles: 防衛・奪取時のスコア（SRD: 30日で線形減衰）、captured_at を「最終更新」として利用
ALTER TABLE tiles ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 100;
