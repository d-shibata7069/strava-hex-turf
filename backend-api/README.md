# backend-api（バックエンド API）

Node.js + TypeScript。H3 インデックス計算などのロジックを担当。現状はライブラリとして利用される想定。

## 環境構築

- Node.js 18 以上を推奨。
- 依存関係のインストール:

```bash
npm install
```

## 開発・テスト

- ビルド: `npm run build`（テストファイルは `exclude` によりビルド対象外。Vitest が別途コンパイルする。）
- テスト: `npm run test`（Vitest）
- ウォッチ: `npm run test:watch`

## Webhook サーバー（Strava アクティビティ処理用）

クライアント（Next.js）の `/api/strava/webhook` が Strava から POST を受信した際、本サーバーの `POST /webhook/activity` を呼び出して `processActivityEvent` を実行する。

- **起動:** `npm run build` の後に `npm run webhook-server`（`backend-api` ディレクトリで実行すること）。
- デフォルトで `http://localhost:3001/webhook/activity` で待ち受け（`PORT` 環境変数で変更可）。
- **環境変数:** 起動時に **backend-api 直下の `.env.local` または `.env`** を自動読み込みする。`SUPABASE_URL`（または `NEXT_PUBLIC_SUPABASE_URL`）と `SUPABASE_SERVICE_ROLE_KEY` が必須。client で Strava トークンを暗号化して保存している場合は、復号用に **`STRAVA_TOKEN_ENCRYPTION_KEY`** を client と同一の値で設定する（未設定なら DB の平文トークンをそのまま使用）。`backend-api/.env.example` をコピーして `backend-api/.env.local` を作成し、値を設定する。
