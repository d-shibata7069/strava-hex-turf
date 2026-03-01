-- アクティビティとタイルの対応（Strava でアクティビティ削除時に、どのタイルを解除するか判定するため）
-- バックエンドの Webhook 処理のみが参照・更新する。RLS は未使用（サービスロールでアクセス）。
CREATE TABLE activity_tiles (
    activity_id   BIGINT NOT NULL,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    h3_index      TEXT NOT NULL,
    group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (activity_id, h3_index, group_id)
);
CREATE INDEX idx_activity_tiles_user_h3_group
    ON activity_tiles (user_id, h3_index, group_id);
CREATE INDEX idx_activity_tiles_activity_id ON activity_tiles (activity_id);
