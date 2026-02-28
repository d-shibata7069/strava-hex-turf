## 概要 (Context)

初期セットアップ: DBスキーマ、H3ユーティリティ、Terraformプロバイダー設定を追加する。

## 対応背景

docs/srd.md に基づき、開発の土台となる以下を構築するため。
- PostgreSQL DDL（users, groups, group_members, tiles, activity_logs）
- GPS座標からH3インデックス（Resolution 7）を算出するユーティリティ
- Vercel・Supabase の Terraform プロバイダー初期設定

## 変更内容 (Changes)

- `db/migrations/20260228000000_initial_schema.sql`: 初期スキーマ（PostGIS拡張、5テーブル、activity_action_type enum）
- `backend-api/src/utils/h3-utils.ts`: `getH3IndexesFromPoints` 関数（h3-js Resolution 7、重複排除）
- `backend-api/src/utils/h3-utils.test.ts`: Vitest によるテスト（6ケース）
- `backend-api/package.json`, `tsconfig.json`: ビルド・テスト環境
- `infra/main.tf`: Vercel / Supabase プロバイダー設定（変数: supabase_access_token, supabase_endpoint）

## 動作確認手順 (How to Test)

1. `cd backend-api && npm install`
2. `npm run test` を実行し、6件のテストがすべてパスすることを確認
3. （オプション）Supabase CLI が導入済みであれば `supabase start` 後 `supabase db reset` でマイグレーション適用を確認

## 影響範囲と懸念事項 (Impact & Concerns)

- `infra/main.tf` 実行時、`supabase_access_token` と `supabase_endpoint` の設定が必要（ terraform.tfvars または環境変数）
- UI の変更は含まないため Vercel Preview での UI 確認は N/A

## チェックリスト (Checklist)

- [x] 必要なテストコードを追加・更新し、すべてパスしている
- [ ] VercelのPreview環境でUIの表示崩れがないか確認できる状態にある（N/A: 本PRはUI未実装）
- [ ] 環境変数（`.env`）の追加や変更が必要な場合、その旨を記載している → Terraform 変数（supabase_access_token, supabase_endpoint）の設定が必要
- [ ] 動作画面に変更がある場合、変更前後のスクリーンショットを載せている（N/A）
