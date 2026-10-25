-- セキュリティ強化: DB 層の権限・RLS の最終状態を保証する（Issue #61）
-- 対応する指摘:
--   A-4 / B-05: activity_tiles に RLS が設定されていない
--   A-5 / B-04: tiles が anon キーで全件読み取り可能（tiles_select_all）
--   A-9 / B-13: SECURITY DEFINER 関数に EXECUTE 制限がない
--   A-8:        groups に作成者（所有者）の概念がないため created_by を追加する
--
-- A-11 への対応:
--   旧 20250303120000_enforce_rls.sql はファイル名の日付が 2025 年になっており、
--   20260228000000_initial_schema.sql（2026 年）より前にソートされ、新規環境では
--   テーブル未作成の状態で ALTER TABLE を実行して失敗した。
--   当該ファイルは 20260303120000_enforce_rls.sql へ改名して順序を是正した。
--   既存 DB では schema_migrations の履歴付け替えが必要（手順は改名先ファイルの
--   ヘッダおよび docs/launch-checklist.md を参照）。あわせて本マイグレーションで、
--   RLS・ポリシー・権限の最終状態を冪等に保証する。
--
-- 本マイグレーションの全ステートメントは冪等であり、再実行しても同じ最終状態になる。

-- =============================================================
-- 1. activity_tiles: RLS を有効化し、anon / authenticated の権限を取り消す（A-4 / B-05）
-- アクセスはサービスロール経由のみ（サービスロールは RLS をバイパスする）。
-- ポリシーは作成しないため、anon / authenticated からは直接アクセスできない。
-- =============================================================

ALTER TABLE public.activity_tiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.activity_tiles FROM anon, authenticated;

COMMENT ON TABLE public.activity_tiles IS
  'アクティビティとタイルの対応。アクセスはサービスロール経由のみ（RLS 有効・ポリシーなし・anon/authenticated の権限なし）。';

-- =============================================================
-- 2. tiles: 全件 SELECT ポリシーを削除し、直接アクセスを拒否する（A-5 / B-04）
-- タイル取得は Next.js API ルート（サービスロール＋セッション＋メンバーシップ検証）
-- 経由のみが正規経路である。anon / authenticated 向けポリシーは作成しない
-- （= ポリシーが無いため、RLS 有効下では直接アクセスは拒否される）。
-- =============================================================

ALTER TABLE public.tiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiles_select_all ON public.tiles;

-- =============================================================
-- 3. SECURITY DEFINER 関数: EXECUTE 権限を service_role のみに制限する（A-9 / B-13）
-- 対象関数のシグネチャは元のマイグレーションで確認したもの:
--   decay_tile_scores()
--     20260301150000_create_decay_scores_rpc.sql で作成、
--     20260301170000_fix_decay_tile_scores_where.sql で再定義。
--   backfill_user_group_daily_stats(DATE, DATE)
--     20260301190000_backfill_user_group_daily_stats_rpc.sql で作成。
--     引数は (p_start_date DATE, p_end_date DATE)。
-- =============================================================

REVOKE EXECUTE ON FUNCTION public.decay_tile_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decay_tile_scores() TO service_role;

REVOKE EXECUTE ON FUNCTION public.backfill_user_group_daily_stats(DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_user_group_daily_stats(DATE, DATE) TO service_role;

-- =============================================================
-- 4. groups.created_by: グループ作成者を記録する列を追加する（A-8）
-- 既存行は NULL（レガシー）のままにする。既存行の作成者は不明であり、
-- 推測で埋めない。作成者を記録するのは本マイグレーション適用後の新規作成分から。
-- =============================================================

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);

COMMENT ON COLUMN public.groups.created_by IS
  'グループ作成者の users.id。既存行は NULL（レガシー）のまま。';
