# Supabase ローカル開発

Supabase CLI を用いたローカル PostgreSQL 環境。マイグレーション管理と `db reset` によるスキーマ適用・検証が可能。

## 前提条件

- [Docker Desktop](https://docs.docker.com/desktop/) がインストール・起動済み
- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction)（`npx supabase` で実行可能）

## 主要コマンド

```bash
# ローカル Supabase を起動（初回はイメージ DL で数分かかる）
npx supabase start

# マイグレーションを適用して DB をリセット
npx supabase db reset

# 停止（データ保持）
npx supabase stop

# 停止（データ削除）
npx supabase stop --no-backup
```

## ディレクトリ構成

| パス | 説明 |
|------|------|
| `migrations/` | バージョン付き SQL マイグレーション（`YYYYMMDDHHMMSS_*.sql`） |
| `config.toml` | ローカル開発用設定（API ポート、DB ポートなど） |
| `.cursorrules` | DB スキーマルール（RLS、インデックス方針） |

## マイグレーション追加

```bash
npx supabase migration new <マイグレーション名>
```

生成された SQL ファイルを編集し、`npx supabase db reset` で適用を確認。

## 参考

- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
