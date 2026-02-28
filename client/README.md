# client（フロントエンド）

Next.js App Router + React + Tailwind CSS。Strava OAuth と Supabase 連携を行う。

## 環境構築

### 1. 依存関係のインストール

```bash
npm install
```

Node.js 18 以上を推奨。

### 2. 環境変数

- `client/.env.example` をコピーして `client/.env.local` を作成する。
- 以下を設定する。
  - **SESSION_SECRET** … セッション Cookie の署名用（32 文字以上のランダム文字列）。本番では必ず推測困難な値を設定すること。
  - **NEXT_PUBLIC_STRAVA_CLIENT_ID** … [Strava API](https://developers.strava.com/) でアプリ登録して取得した Client ID。
  - **STRAVA_CLIENT_SECRET** … 同上の Client Secret。
  - **NEXT_PUBLIC_APP_URL** … アプリのベース URL（ローカルは `http://localhost:3000`、末尾スラッシュなし）。
  - **NEXT_PUBLIC_SUPABASE_URL** … Supabase ダッシュボードの **Settings → API** にある Project URL。
  - **NEXT_PUBLIC_SUPABASE_ANON_KEY** … 同上の **Project API keys** の `anon` (public)。
  - **SUPABASE_SERVICE_ROLE_KEY** … 同上の **Project API keys** の `service_role`（「Reveal」で表示する secret）。RLS をバイパスするため **サーバー側（API Route 等）でのみ** 使用し、クライアントやリポジトリに載せないこと。
- Strava アプリ設定の「Authorization Callback Domain」に、コールバックのホスト（例: `localhost`）を登録する。

### 3. 開発サーバー

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開く。

### 4. Storybook（UI 確認用）

```bash
npm run storybook
```

「App/Map」で地図コンポーネントと H3 六角形レイヤーの表示を確認できる。

### 5. 地図表示（MapLibre）

地図は [MapLibre GL JS](https://maplibre.org/) と [@vis.gl/react-maplibre](https://visgl.github.io/react-maplibre/) を使用している（Mapbox に依存しないオープンソース構成）。

- **タイルの取得:** 開発時は `https://demotiles.maplibre.org/style.json` を参照しており、追加の API キーや環境変数は不要。
- **H3 の可視化:** `h3-js` で Resolution 7 の H3 インデックスを GeoJSON ポリゴンに変換し、地図上に六角形レイヤーとして描画している。モックデータは新宿付近のセルを表示。
- 本番で別のタイルサーバー（例: 自前のスタイル JSON）を使う場合は、`app/components/Map.tsx` の `mapStyle` を変更するか、環境変数で差し替え可能にできる。

## データベース

Strava OAuth ログインでは `users` テーブルを使用するため、[supabase/README.md](../supabase/README.md) に従い、初期マイグレーションを適用した状態にしておく。
