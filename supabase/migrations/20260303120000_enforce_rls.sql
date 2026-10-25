-- 【改名履歴】本ファイルは旧名 20250303120000_enforce_rls.sql（2025 年の日付）で、
-- ファイル名順では初期スキーマ（20260228000000）より前に並び、新規環境で
-- テーブル未作成のまま失敗する問題があったため、20260303120000 へ改名した（A-11）。
-- 既存 DB では schema_migrations に旧バージョンが残るため、適用時に
-- `supabase migration repair --status reverted 20250303120000` と
-- `supabase migration repair --status applied 20260303120000` で履歴を付け替えること。
-- 内容自体は同一であり、ポリシーの最終状態は 20260407000000_security_hardening.sql が保証する。
--
-- Enforce RLS on all target tables to prevent unauthorized read/write via Anon Key.
-- Service Role Key (backend) bypasses RLS; only intended client access is allowed.

-- =============================================================
-- 1. Enable ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 2. users: 自分のデータのみ SELECT / UPDATE 可能
-- =============================================================

DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- =============================================================
-- 3. tiles: 誰でも SELECT 可能。INSERT/UPDATE/DELETE はポリシーなし
-- （Service Role を持つバックエンドのみ書き込み可能）
-- =============================================================

DROP POLICY IF EXISTS "tiles_select_same_group" ON tiles;
DROP POLICY IF EXISTS "tiles_select_all" ON tiles;
CREATE POLICY "tiles_select_all" ON tiles
  FOR SELECT USING (true);

-- =============================================================
-- 4. group_members: 自分が所属しているレコードのみ SELECT 可能
-- =============================================================

DROP POLICY IF EXISTS "group_members_select_same_group" ON group_members;
DROP POLICY IF EXISTS "group_members_select_own" ON group_members;
CREATE POLICY "group_members_select_own" ON group_members
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================================
-- 5. groups / activity_logs: RLS のみ有効化
-- ポリシーは付与しないため、Anon/Authenticated ではアクセス不可。
-- 必要に応じてバックエンド（Service Role）または別マイグレーションでポリシーを追加すること。
-- =============================================================
