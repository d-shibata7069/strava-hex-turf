-- decay_tile_scores の UPDATE に WHERE 句を追加（Supabase の UPDATE requires WHERE 制約対応）。
-- 既存の 20260301150000 は適用済みのため、CREATE OR REPLACE で関数のみ更新する。

CREATE OR REPLACE FUNCTION decay_tile_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE tiles
  SET score = GREATEST(
    0,
    (100 - (EXTRACT(EPOCH FROM (now() - last_updated_at)) / 86400.0 / 30.0) * 100)::integer
  )
  WHERE true;
END;
$$;
