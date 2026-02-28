# strava-hex-turf

Strava API と H3 インデックス（Resolution 7）を利用したランナー向けの陣取り Web アプリケーション。要件定義は [docs/srd.md](docs/srd.md) を参照。

## ディレクトリ構成

| ディレクトリ | 内容 |
|-------------|------|
| `client` | フロントエンド（Next.js App Router, React, Tailwind CSS） |
| `backend-api` | バックエンド API（Node.js, TypeScript） |
| `batch` | 定期実行処理 |
| `db` | Supabase マイグレーション（SQL） |
| `infra` | Terraform（インフラ） |
| `docs` | 仕様書（srd.md 等） |

## 環境構築

### 共通

- Node.js 18 以上を推奨。
- リポジトリルートで必要なディレクトリごとに `npm install` を実行する。

### クライアント（`client`）

1. **依存関係のインストール**
   ```bash
   cd client && npm install
   ```

2. **環境変数**
   - `client/.env.example` をコピーして `client/.env.local` を作成する。
   - 以下を設定する。
     - `NEXT_PUBLIC_STRAVA_CLIENT_ID` … [Strava API](https://developers.strava.com/) でアプリ登録して取得した Client ID。
     - `STRAVA_CLIENT_SECRET` … 同上の Client Secret。
     - `NEXT_PUBLIC_APP_URL` … アプリのベース URL（ローカルは `http://localhost:3000`、末尾スラッシュなし）。
     - `NEXT_PUBLIC_SUPABASE_URL` … Supabase ダッシュボードの Project URL。
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` … Supabase の anon public key。
     - `SUPABASE_SERVICE_ROLE_KEY` … Supabase の service_role key（サーバー側のみで使用し、漏洩に注意）。
   - Strava アプリ設定の「Authorization Callback Domain」に、コールバックのホスト（例: `localhost`）を登録する。

3. **開発サーバー**
   ```bash
   npm run dev
   ```
   - ブラウザで `http://localhost:3000` を開く。

4. **Storybook（UI 確認用）**
   ```bash
   npm run storybook
   ```

### データベース（Supabase）

- `db/migrations/` の SQL を Supabase プロジェクトに適用する（例: Supabase CLI の `supabase db push` またはダッシュボードから実行）。
- クライアントの Strava OAuth ログインでは `users` テーブルを使用するため、[20260228000000_initial_schema.sql](db/migrations/20260228000000_initial_schema.sql) を適用した状態にしておく。
