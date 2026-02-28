## 概要 (Context)

Strava Webhook の受信と、アクティビティに基づく tiles テーブル更新ロジックをバックエンドに実装する。

## 対応背景

- SRD に従い、Strava にアクティビティがアップロードされた直後に Webhook 経由で通過タイルの所有権を即時更新する必要がある。
- 購読確認（GET）とイベント処理（POST）の両方に対応するサービス層を用意し、テスト可能な形で実装する。

## 変更内容 (Changes)

- `backend-api/package.json`: `@mapbox/polyline`・`@supabase/supabase-js` を追加（vitest は既存）。
- `backend-api/src/services/strava-webhook.ts`: 新規追加。
  - **Webhook 検証 (GET)**: `hub.challenge` をそのまま返す `verifyWebhook(query)`。
  - **アクティビティ処理 (POST)**: `processActivityEvent(objectId, ownerId, supabase, fetchStravaActivity)` — users からトークン取得 → Strava API で `map.summary_polyline` 取得 → Polyline デコード → `getH3IndexesFromPoints` で H3 取得 → tiles を Upsert（owner_id, score=100, captured_at=now）。
- `backend-api/src/services/strava-webhook.test.ts`: ダミー Polyline とモック Supabase/Strava を用いた単体テスト。
- `backend-api/src/utils/h3-utils.test.ts`: ESM のため import パスを `.js` に変更。
- `backend-api/src/types/polyline.d.ts`: `@mapbox/polyline` の型宣言を追加。
- `supabase/migrations/20260228100000_webhook_and_tiles_score.sql`: users に `strava_access_token` / `strava_refresh_token`、tiles に `score` を追加。

## 動作確認手順 (How to Test)

1. `/backend-api` 内で `npm install` を実行する。
2. `/backend-api` 内で `npm test` を実行し、テストコードがすべて Pass することを確認する。
3. （任意）`npm run build` で TypeScript が問題なくビルドできることを確認する。

## 影響範囲と懸念事項 (Impact & Concerns)

- `users` に `strava_access_token` を保存する前提。OAuth コールバック側でトークンを users に保存する実装が必要（本 PR ではクライアントは変更しない）。
- tiles の Upsert は「ユーザーが所属する全グループ」に対して行う。グループ単位でタイルを分ける設計を維持している。

## チェックリスト (Checklist)

- [x] 必要なテストコードを追加・更新し、すべてパスしている
- [ ] VercelのPreview環境でUIの表示崩れがないか確認できる状態にある（本 PR はバックエンドのみのため該当しない場合は N/A）
- [ ] 環境変数（`.env`）の追加や変更が必要な場合、その旨を記載している
- [ ] 動作画面に変更がある場合、変更前後のスクリーンショットを載せている
