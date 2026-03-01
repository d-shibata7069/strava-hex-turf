-- 既存環境で 2 本目マイグレーションが未適用だった場合に備え、
-- tiles.score / last_updated_at と users のトークン列を確実に存在させる。
-- IF NOT EXISTS のため、既に適用済みの DB では何も変更されない（冪等）。
-- 本番・手動適用のみのプロジェクトでも supabase db push 一発でスキーマが揃う。

ALTER TABLE tiles
    ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
    ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS strava_token_expires_at TIMESTAMPTZ;
