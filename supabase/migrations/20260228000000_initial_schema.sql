-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =============================================================
-- users
-- =============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strava_id       BIGINT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    icon_url        TEXT,
    privacy_zone    GEOMETRY(Polygon, 4326),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_strava_id ON users (strava_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
    ON users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "users_update_own"
    ON users FOR UPDATE
    USING (id = auth.uid());

-- =============================================================
-- groups
-- =============================================================
CREATE TABLE groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    invite_code     TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_select_member"
    ON groups FOR SELECT
    USING (
        id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
    );

-- =============================================================
-- group_members (many-to-many)
-- =============================================================
CREATE TABLE group_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_group_id ON group_members (group_id);
CREATE INDEX idx_group_members_user_id  ON group_members (user_id);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_select_same_group"
    ON group_members FOR SELECT
    USING (
        group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
    );

-- =============================================================
-- tiles
-- =============================================================
CREATE TABLE tiles (
    h3_index        TEXT NOT NULL,
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (h3_index, group_id)
);

CREATE INDEX idx_tiles_owner_id  ON tiles (owner_id);
CREATE INDEX idx_tiles_group_id  ON tiles (group_id);

ALTER TABLE tiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiles_select_same_group"
    ON tiles FOR SELECT
    USING (
        group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
    );

-- =============================================================
-- activity_logs
-- =============================================================
CREATE TYPE activity_action AS ENUM ('capture', 'defend', 'decay');

CREATE TABLE activity_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action          activity_action NOT NULL,
    h3_index        TEXT,
    message         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_group_id   ON activity_logs (group_id);
CREATE INDEX idx_activity_logs_user_id    ON activity_logs (user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select_same_group"
    ON activity_logs FOR SELECT
    USING (
        group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
    );
