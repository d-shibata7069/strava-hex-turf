-- Initial schema for Strava陣取りWebサービス
-- docs/srd.md に基づく DDL

-- PostGIS拡張を有効化（プライバシーゾーン用Polygon）
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. users: Strava ID、表示名、設定アイコンURL、プライバシーゾーン（Polygonデータ）
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strava_id       BIGINT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    icon_url        TEXT,
    privacy_zone    GEOMETRY(Polygon, 4326),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. groups: グループID、グループ名
CREATE TABLE groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. group_members: ユーザーとグループの中間テーブル
CREATE TABLE group_members (
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

-- 4. tiles: H3インデックス（主キー）、現在の所有者ID、最終更新日時（防衛・奪取のタイムスタンプ）
-- Resolution 7 のH3インデックスを文字列で格納
CREATE TABLE tiles (
    h3_index        TEXT PRIMARY KEY,
    owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiles_owner_id ON tiles(owner_id);
CREATE INDEX idx_tiles_updated_at ON tiles(updated_at);

-- 5. activity_logs: ログID、対象グループID、アクション種別（奪取、防衛、減衰）、関連ユーザーID、メッセージ
CREATE TYPE activity_action_type AS ENUM ('capture', 'defense', 'decay');

CREATE TABLE activity_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    action_type     activity_action_type NOT NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    message         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_group_id ON activity_logs(group_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
