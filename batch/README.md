# batch（定期実行処理）

Strava Webhook やスコア減衰など、定期実行・イベント駆動の処理を担当するパッケージ。

## 環境構築

- Node.js 18 以上を推奨。
- 依存のインストール: `npm install`
- Supabase へ接続するため、このディレクトリ（`batch/`）直下に `.env` または `.env.local` を置き、以下を設定する。
  - `SUPABASE_URL`: Supabase プロジェクトの URL（例: `https://xxxx.supabase.co`）
  - `SUPABASE_SERVICE_ROLE_KEY`: サービスロールキー（Supabase ダッシュボード → Settings → API）
  - 設定例は `.env.example` を参照。

## タイルスコア減衰バッチ（decay-scores）

### 目的

獲得タイルのスコア（`tiles.score`）は、最終更新日時（`last_updated_at`）から 30 日かけて 100 → 0 に線形減衰する（[docs/srd.md](../docs/srd.md) のゲームメカニクスに準拠）。  
このバッチは、PostgreSQL の RPC `decay_tile_scores` を呼び出し、全タイルのスコアを一括更新する。更新ロジックは DB 内で完結するため、パフォーマンス要件を満たす。

### ローカルでの実行

```bash
cd batch
npm install
npm run build
npm run start:decay
```

- 成功時: 標準出力に `[decay-scores] 成功 処理時間: xxx ms` が出力される。
- 失敗時: エラーメッセージが標準エラーに出力され、終了コード 1 で終了する。

### テスト

```bash
npm run test
```
