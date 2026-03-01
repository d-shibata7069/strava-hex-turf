-- 日次スナップショット: グループ別・ユーザー別のタイル数・合計スコアを日付ごとに保存する。
-- チャート表示（成績推移）用。batch で日次集計して投入する想定。
CREATE TABLE user_group_daily_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    record_date     DATE NOT NULL,
    tile_count      INTEGER NOT NULL DEFAULT 0,
    total_score     INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, group_id, record_date)
);
CREATE INDEX idx_user_group_daily_stats_user_group ON user_group_daily_stats (user_id, group_id);
CREATE INDEX idx_user_group_daily_stats_record_date ON user_group_daily_stats (record_date);

ALTER TABLE user_group_daily_stats ENABLE ROW LEVEL SECURITY;

-- 同じグループのメンバーが参照可能
CREATE POLICY "user_group_daily_stats_select_same_group"
    ON user_group_daily_stats FOR SELECT
    USING (
        group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    );

-- get_group_leaderboard: 戻り値に total_score を追加（所有タイルの score 合計）
DROP FUNCTION IF EXISTS get_group_leaderboard(UUID);

CREATE OR REPLACE FUNCTION get_group_leaderboard(target_group_id UUID)
RETURNS TABLE (
    user_id      UUID,
    display_name TEXT,
    icon_url     TEXT,
    tile_count   BIGINT,
    total_score  BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    u.id                    AS user_id,
    u.display_name,
    u.icon_url,
    COUNT(t.h3_index)::BIGINT  AS tile_count,
    COALESCE(SUM(t.score), 0)::BIGINT AS total_score
  FROM tiles t
  INNER JOIN users u ON u.id = t.owner_id
  WHERE t.group_id = target_group_id
  GROUP BY u.id, u.display_name, u.icon_url
  ORDER BY tile_count DESC;
$$;

COMMENT ON FUNCTION get_group_leaderboard(UUID) IS
  '指定グループ内のユーザーごとの獲得タイル数・合計スコアを返す。リーダーボード用。';
