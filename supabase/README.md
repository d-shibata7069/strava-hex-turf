# supabase（データベース・マイグレーション）

Supabase プロジェクトで PostgreSQL を利用。マイグレーションは `migrations/` に配置する。

## 環境構築

- `migrations/` 内の SQL を Supabase プロジェクトに**順番に**適用する。
  - **Supabase CLI:** `supabase db push`（プロジェクト紐付け済みの場合）
  - **手動:** Supabase ダッシュボードの SQL Editor で、まず [20260228000000_initial_schema.sql](migrations/20260228000000_initial_schema.sql)、次に [20260228100000_tiles_score_and_users_token.sql](migrations/20260228100000_tiles_score_and_users_token.sql) を実行
- 初期スキーマ（`20260228000000`）の `users` には **Strava トークン用カラムは含まれていない**。それらは **2 本目のマイグレーション**（`20260228100000_tiles_score_and_users_token.sql`）で `ALTER TABLE users ADD COLUMN ...` により追加される。ログインでトークン保存や Webhook を使う場合は、この 2 本目を必ず適用すること。

## マイグレーションファイル

| ファイル                                         | 内容                                                         |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `20260228000000_initial_schema.sql`              | 初期スキーマ（users 等）                                     |
| `20260228100000_tiles_score_and_users_token.sql` | tiles の score / last_updated_at、users の Strava トークン列 |

## トラブルシューティング

### 「Could not find the 'strava_access_token' column」が出る（PGRST204）

**原因:** `users` にトークン用カラムがないか、PostgREST のスキーマキャッシュが古い。

**手順（確実に直す）:**

1. [Supabase ダッシュボード](https://supabase.com/dashboard) → 対象プロジェクト → **SQL Editor**
2. **まずカラムを追加する**（2 本目のマイグレーションと同じ内容）。まだ実行していなければ次を実行する:
   ```sql
   -- Users: Strava トークン用（未追加なら実行）
   ALTER TABLE users
       ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
       ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
       ADD COLUMN IF NOT EXISTS strava_token_expires_at TIMESTAMPTZ;
   ```
3. **次に PostgREST のスキーマキャッシュを更新する:**
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
4. 数十秒待ってから、再度 Strava ログインを試す。

参考: [PostgREST not recognizing new columns](https://supabase.com/docs/guides/troubleshooting/postgrest-not-recognizing-new-columns-or-functions-bd75f5)
