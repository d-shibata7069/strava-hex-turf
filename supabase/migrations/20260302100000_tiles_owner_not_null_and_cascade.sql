-- 退会時はタイルも削除し、owner_id を NOT NULL に戻す。
-- 理由: owner_id が NULL のタイルが残ると、backfill_user_group_daily_stats 等が
-- user_id = NULL で user_group_daily_stats に挿入しようとして NOT NULL 制約違反になる。
-- 既存の NULL タイルを削除してから制約を戻す。

-- 退会済みユーザー由来の owner_id IS NULL のタイルを削除
DELETE FROM tiles WHERE owner_id IS NULL;

ALTER TABLE tiles
  DROP CONSTRAINT IF EXISTS tiles_owner_id_fkey;

ALTER TABLE tiles
  ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE tiles
  ADD CONSTRAINT tiles_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
