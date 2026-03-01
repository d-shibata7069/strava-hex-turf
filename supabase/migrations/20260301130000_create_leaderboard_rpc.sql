-- グループ内のユーザーごとの獲得タイル数ランキングを返す RPC。
-- 集計は DB 側で行い、パフォーマンスを確保する。
-- 戻り値: user_id, display_name, icon_url, tile_count（降順）

CREATE OR REPLACE FUNCTION get_group_leaderboard(target_group_id UUID)
RETURNS TABLE (
    user_id     UUID,
    display_name TEXT,
    icon_url    TEXT,
    tile_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    u.id         AS user_id,
    u.display_name,
    u.icon_url,
    COUNT(t.h3_index)::BIGINT AS tile_count
  FROM tiles t
  INNER JOIN users u ON u.id = t.owner_id
  WHERE t.group_id = target_group_id
  GROUP BY u.id, u.display_name, u.icon_url
  ORDER BY tile_count DESC;
$$;

COMMENT ON FUNCTION get_group_leaderboard(UUID) IS
  '指定グループ内のユーザーごとの獲得タイル数を降順で返す。リーダーボード用。';
