-- 獲得タイルのスコアを時間経過に応じて線形減衰させる RPC。
-- 30日で 100 → 0 に減衰。スコアは 0 未満にならない。
-- バッチから呼び出し、更新ロジックは PostgreSQL 内で完結させる（パフォーマンス要件）。

CREATE OR REPLACE FUNCTION decay_tile_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  elapsed_days double precision;
  new_score integer;
BEGIN
  UPDATE tiles
  SET score = GREATEST(
    0,
    (100 - (EXTRACT(EPOCH FROM (now() - last_updated_at)) / 86400.0 / 30.0) * 100)::integer
  );
END;
$$;

COMMENT ON FUNCTION decay_tile_scores() IS
  'tiles の全レコードの score を、last_updated_at からの経過日数に応じて 30 日で 100→0 に線形減衰させる。下限 0。';
