-- 日次スナップショットの一括投入（バックフィル）用 RPC。
-- 指定期間の各日について、現在の tiles から「その日時点で有効だった」タイル数・合計スコアを算出し、
-- user_group_daily_stats に UPSERT する。last_updated_at から 30 日以内のタイルのみカウント（減衰仕様に準拠）。

CREATE OR REPLACE FUNCTION backfill_user_group_daily_stats(p_start_date DATE, p_end_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  d DATE;
  v_tile_count INTEGER;
  v_total_score INTEGER;
BEGIN
  IF p_start_date > p_end_date THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT t.owner_id AS user_id, t.group_id
    FROM tiles t
  LOOP
    d := p_start_date;
    WHILE d <= p_end_date LOOP
      SELECT
        COUNT(*)::integer,
        COALESCE(SUM(
          GREATEST(0, 100 - (100.0 * (d - (t2.last_updated_at)::date) / 30.0)::integer)
        ), 0)::integer
      INTO v_tile_count, v_total_score
      FROM tiles t2
      WHERE t2.owner_id = r.user_id
        AND t2.group_id = r.group_id
        AND (t2.last_updated_at)::date <= d
        AND (t2.last_updated_at)::date > d - 30;

      INSERT INTO user_group_daily_stats (user_id, group_id, record_date, tile_count, total_score)
      VALUES (r.user_id, r.group_id, d, COALESCE(v_tile_count, 0), COALESCE(v_total_score, 0))
      ON CONFLICT (user_id, group_id, record_date)
      DO UPDATE SET
        tile_count = EXCLUDED.tile_count,
        total_score = EXCLUDED.total_score;

      d := d + 1;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION backfill_user_group_daily_stats(DATE, DATE) IS
  '指定日範囲で、全 (owner_id, group_id) の日次タイル数・合計スコアを現在の tiles から算出し user_group_daily_stats に UPSERT する。手動バックフィル用。';
