# supabase（データベース・マイグレーション）

Supabase プロジェクトで PostgreSQL を利用。マイグレーションは `migrations/` に配置する。

## 環境構築

- `migrations/` 内の SQL を Supabase プロジェクトに適用する。
  - **Supabase CLI:** `supabase db push`（プロジェクト紐付け済みの場合）
  - **手動:** Supabase ダッシュボードの SQL Editor で各ファイルを実行
- クライアントの Strava OAuth ログインでは `users` テーブルを使用するため、少なくとも [migrations/20260228000000_initial_schema.sql](migrations/20260228000000_initial_schema.sql) を適用した状態にしておく。

## マイグレーションファイル

| ファイル                            | 内容                     |
| ----------------------------------- | ------------------------ |
| `20260228000000_initial_schema.sql` | 初期スキーマ（users 等） |
