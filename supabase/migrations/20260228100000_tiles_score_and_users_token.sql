-- Tiles: スコア減衰と最終更新日時（SRD: 防衛・奪取のタイムスタンプ、色の濃さ）
ALTER TABLE tiles
    ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Users: Strava API 用アクセストークン（Webhook 処理で /activities/{id} 取得に使用）
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
    ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS strava_token_expires_at TIMESTAMPTZ;
