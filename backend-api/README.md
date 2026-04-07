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

クライアント（Next.js）の `/api/strava/webhook` が Strava から POST を受信した際、本サーバーの `POST /webhook/activity`（アクティビティ）または `POST /webhook/deauthorization`（連携解除）を呼び出す。

- **Strava アプリ設定の Callback URL:** `https://<your-domain>/api/strava/webhook`（ローカル検証時は `http://localhost:3000/api/strava/webhook`）。

- **起動:** `npm run build` の後に `npm run webhook-server`（`backend-api` ディレクトリで実行すること）。
- デフォルトで `http://localhost:3001/webhook/activity` で待ち受け（`PORT` 環境変数で変更可）。
- **環境変数:** 起動時に **backend-api 直下の `.env.local` または `.env`** を自動読み込みする。`SUPABASE_URL`（または `NEXT_PUBLIC_SUPABASE_URL`）と `SUPABASE_SERVICE_ROLE_KEY` が必須。client で Strava トークンを暗号化して保存している場合は、復号用に **`STRAVA_TOKEN_ENCRYPTION_KEY`** を client と同一の値で設定する（未設定なら DB の平文トークンをそのまま使用）。`backend-api/.env.example` をコピーして `backend-api/.env.local` を作成し、値を設定する。


### POST /webhook/deauthorization

Strava webhook の `object_type=athlete`（`aspect_type=update` / `delete`）を受け取り、`owner_id` をキーに `users.strava_id` を検索して `users` 行を削除する。
`users` からの削除は既存 FK の `ON DELETE CASCADE` 前提で、関連行（タイル・ログ等）も同時に削除される。

- **リクエストボディ（JSON）**
  - `owner_id` (number, 必須): Strava の Athlete ID
- **レスポンス**
  - 成功: `200` + `{ "ok": true }`
  - 対象なし: `200` + `{ "ok": true, "skipped": true }`
  - 失敗: `400`（必須項目不足・不正）/ `500`（DB エラー） + `{ "error": "メッセージ" }`
- **リトライ方針:** `500` 時は webhook 再送で再試行可能。サーバーログには `deauthorization ... (retryable)` として `owner_id` とエラー内容を出力する。

## OpenAPI 仕様

BFF/Webhook エンドポイントの仕様は `backend-api/openapi.yaml` で管理する。

### ローカルでの検証

```bash
cd backend-api
npm install
npm run openapi:lint
```

- 構文エラー・参照不整合がある場合は `openapi:lint` が失敗する。
- CI でも同じコマンドを実行し、仕様ファイルの破損を防ぐ。

## BFF エンドポイント（Backend For Frontend）

フロントエンドからの直接 DB 操作を廃止し、バックエンド経由で行うための API。いずれも `POST`、Content-Type: `application/json`。同一の Webhook サーバー（`npm run webhook-server`）で待ち受ける。

### POST /users/sync

ユーザー情報（Strava トークン含む）を受け取り、トークンを暗号化して `users` テーブルに upsert する。

- **リクエストボディ（JSON）**
  - `strava_id` (number, 必須): Strava の Athlete ID
  - `access_token` (string, 必須): Strava アクセストークン（平文。サーバー側で暗号化して保存）
  - `refresh_token` (string, 必須): Strava リフレッシュトークン（平文。サーバー側で暗号化して保存）
  - `display_name` (string, 任意): 表示名。省略時は `User {strava_id}`
  - `profile_image_url` / `icon_url` (string | null, 任意): アイコン URL
  - `strava_token_expires_at` (string | null, 任意): トークン有効期限（ISO 8601）
- **レスポンス**
  - 成功: `200` + `{ "ok": true, "id": "uuid", "should_run_initial_backfill": true|false }`
  - 失敗: `400`（必須項目不足・不正）/ `500`（暗号化失敗・DB エラー） + `{ "error": "メッセージ" }`

### POST /users/initial-backfill

初回連携時のみ、対象ユーザーの過去7日分の Strava アクティビティを取り込み、タイル反映を実行する。
このエンドポイントは内部実行専用で、`x-internal-backfill-key` ヘッダーが `INTERNAL_BACKFILL_API_KEY` と一致しない場合は `403` を返す。

- **リクエストボディ（JSON）**
  - `strava_id` (number, 必須): Strava の Athlete ID
  - `base_time` (string, 任意): 取り込み基点時刻（ISO 8601）。未指定時はサーバー現在時刻。
- **レスポンス**
  - 成功（初回取り込み実行）: `200` + `{ "ok": true, "processed_activity_count": number, "base_time": "..." }`
  - 成功（既に実行済み）: `200` + `{ "ok": true, "skipped": true }`
  - 失敗: `400`（必須項目不足・不正）/ `403`（内部キー不一致）/ `404`（ユーザー未登録）/ `500` + `{ "error": "メッセージ" }`

#### 動作確認用スクリプト（内部向け）

リポジトリ直下の `scripts/run-initial-backfill.sh` で、基点時刻を指定してバックフィルを実行できる。

```bash
INTERNAL_BACKFILL_API_KEY=xxxxx BACKEND_API_URL=http://localhost:3001 \
  ./scripts/run-initial-backfill.sh 123456 2026-04-06T00:00:00Z
```

- 第2引数（基点時刻）省略時は現在時刻（UTC）を使用。
- 実行は内部キーが必要なため、一般ユーザーからは直接実行できない。

### POST /groups

グループ名を受け取り、招待コードを自動生成（重複時はリトライ）して `groups` と `group_members` に insert する。

- **リクエストボディ（JSON）**
  - `name` (string, 必須): グループ名
  - `user_id` (string, 必須): 作成者ユーザーの UUID（フロントのセッション等で取得した id）
- **レスポンス**
  - 成功: `200` + `{ "ok": true, "group_id": "uuid", "name": "グループ名", "invite_code": "8文字16進" }`
  - 失敗: `400`（name 空・user_id 不正）/ `409`（招待コード衝突がリトライ上限超過）/ `500` + `{ "error": "メッセージ" }`

### POST /groups/join

招待コードを受け取り、対象グループを検索して `group_members` に insert する。

- **リクエストボディ（JSON）**
  - `invite_code` (string, 必須): 招待コード（8 文字 16 進）
  - `user_id` (string, 必須): 参加するユーザーの UUID
- **レスポンス**
  - 成功: `200` + `{ "ok": true, "group_id": "uuid" }`
  - 失敗: `400`（招待コード空・user_id 不正）/ `404`（招待コードに一致するグループなし）/ `409`（既に参加済み）/ `500` + `{ "error": "メッセージ" }`
