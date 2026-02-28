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

- 起動: `npm run build` の後に `npm run webhook-server`
- デフォルトで `http://localhost:3001/webhook/activity` で待ち受け（`PORT` 環境変数で変更可）。
- 必要な環境変数: `SUPABASE_URL`（または `NEXT_PUBLIC_SUPABASE_URL`）、`SUPABASE_SERVICE_ROLE_KEY`
