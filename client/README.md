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
  - **STRAVA_TOKEN_ENCRYPTION_KEY** … Strava のアクセス／リフレッシュトークンを DB に保存する前に暗号化するための鍵（32 バイトの base64）。本番では必ず設定すること。生成例: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`。backend-api の Webhook サーバーでも同じ値を設定する。
  - **STRAVA_WEBHOOK_VERIFY_TOKEN** … Strava Webhook 購読確認用。Strava の Webhook 設定で設定する「Verify Token」と同一の文字列にすること。
  - **BACKEND_API_URL** … アクティビティ処理を行う backend-api の Webhook サーバー URL（例: ローカル `http://localhost:3001`、末尾スラッシュなし）。[backend-api/README.md](../backend-api/README.md) の「Webhook サーバー」を参照。
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

### 5. Strava Webhook のローカル確認（ngrok 等）

Strava は Webhook のコールバックに **公的な URL** を要求するため、ローカルで受信するには [ngrok](https://ngrok.com/) 等でトンネルを張る。

**注意:** Strava の設定画面には Webhook 用の UI はない。購読の作成は **API** で行う（[公式ドキュメント](https://developers.strava.com/docs/webhooks/)）。トークン類はすべて **環境変数**（`.env.local`）で指定し、`client/scripts/strava-webhook-subscription.mjs` が読み込んで利用する。

#### 手順

1. **backend-api** で `npm run build && npm run webhook-server` を起動し、`http://localhost:3001` で Webhook 処理サーバーを待ち受けさせる。
2. **client** で `npm run dev` を起動する。
3. **ngrok** でクライアントを公開する（例: `ngrok http 3000`）。表示された HTTPS URL（例: `https://xxxx.ngrok.io`）を控える。
4. **`.env.local`** に次を設定する（トークン類はすべてここに記載し、スクリプト・アプリ両方で参照する）。
   - `NEXT_PUBLIC_APP_URL=https://xxxx.ngrok.io`（ngrok の URL、末尾スラッシュなし）
   - `BACKEND_API_URL=http://localhost:3001`
   - `STRAVA_WEBHOOK_VERIFY_TOKEN=<任意の文字列>`（購読作成時の verify_token として Strava API に送る値）
   - 既存の `NEXT_PUBLIC_STRAVA_CLIENT_ID` と `STRAVA_CLIENT_SECRET` も [Strava API 設定](https://www.strava.com/settings/api) の値になっていること。
   - 設定後、**client を再起動**して環境変数を読み込ませる。
5. **購読の作成:** `client` ディレクトリで次を実行する。`.env.local` の値を使って Strava API に購読作成リクエストを送る。
   ```bash
   npm run webhook:subscribe
   ```
   成功すると `{"id":12345}` のような JSON が表示される。Strava が直後に GET で検証に来るため、その時点で client が起動しており、`STRAVA_WEBHOOK_VERIFY_TOKEN` が一致していれば購読が有効になる。
6. **本番:** `.env.local`（または本番用環境変数）の `NEXT_PUBLIC_APP_URL` を Vercel の URL（例: `https://your-app.vercel.app`）にし、同じく `npm run webhook:subscribe` で購読を作成する。

#### Webhook 購読用 npm スクリプト（環境変数でトークン指定）

| コマンド                                      | 説明                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run webhook:subscribe`                   | 購読を作成。`NEXT_PUBLIC_APP_URL` + `/api/strava/webhook` が callback_url、`STRAVA_WEBHOOK_VERIFY_TOKEN` が verify_token として使われる。 |
| `npm run webhook:subscription:view`           | 現在の購読を表示（client_id / client_secret は .env.local から読み込み）。                                                                |
| `npm run webhook:subscription:delete -- <id>` | 指定した ID の購読を削除。ID は `webhook:subscription:view` の結果か、環境変数 `STRAVA_WEBHOOK_SUBSCRIPTION_ID` で指定可能。              |

スクリプト本体は `client/scripts/strava-webhook-subscription.mjs`。未設定の必須環境変数があるとエラーメッセージで案内する。

### 6. グループ（作成・参加・退会・削除）

陣地タイルは「グループ単位」で管理される。Webhook でタイルが書き込まれるには、**そのユーザーが少なくとも 1 つのグループに所属している**必要がある（`group_members` にレコードがあること）。

- **グループの作成:** ヘッダーの「作成」から `/groups/new` に遷移し、グループ名を入力して「作成する」を押す。招待コードは自動で発行され、作成直後に表示される。作成者本人が自動的にそのグループのメンバーとして登録される。
- **参加:** ヘッダーの「参加」から `/join` に遷移し、招待コードを入力して「参加する」を押す。
- **マイグループ:** ヘッダーの「マイグループ」から `/groups` で参加中のグループ一覧を表示できる。各グループで「退会」（自分だけメンバーから外れる）または「削除」（グループごと削除。メンバーなら誰でも実行可能。グループ内の陣地データも CASCADE で削除される）が可能。

### 7. 地図表示（MapLibre）

地図は [MapLibre GL JS](https://maplibre.org/) と [@vis.gl/react-maplibre](https://visgl.github.io/react-maplibre/) を使用している（Mapbox に依存しないオープンソース構成）。

- **タイルの取得:** ベース地図は OpenStreetMap のラスタータイル（`https://tile.openstreetmap.org/{z}/{x}/{y}.png`）をスタイル内で直接指定しており、追加の API キーや環境変数は不要。外部ベクトルタイルに依存しないため表示が安定している。
- **H3 の可視化:** `h3-js` で Resolution 7 の H3 インデックスを GeoJSON ポリゴンに変換し、地図上に六角形レイヤーとして描画している。実データは `/api/tiles` から取得し、スコアに応じた濃さで表示する。
- 本番で別のタイルサーバー（例: 自前のスタイル JSON）を使う場合は、`components/organisms/Map.tsx` の `mapStyle` を変更するか、環境変数で差し替え可能にできる。

### テスト用タイルの手動投入（地図に実データを出す）

地図に「陣地」を表示するには、Supabase の `tiles` テーブルにレコードが必要です。Webhook 経由で自動投入される前提ですが、**動作確認用**にダッシュボードから手で 1 件入れる手順です。

**前提:** 一度でも Strava でログインしており、`users` に自分のレコードがあること。かつ、自分が所属するグループが 1 つ以上あること。所属はアプリの「グループに参加」（`/join`）で招待コードを入力して行う（上記「グループへの参加」参照）。手動で `group_members` を触る場合は以下。

1. **自分の user ID と所属グループ ID を確認する**
   - Supabase ダッシュボード → **Table Editor** で `users` を開く。ログイン時に作られた自分の行の **id**（UUID）をコピー → これが **owner_id** に使う値。
   - **Table Editor** で `groups` を開く。テスト用グループがなければ「Insert row」で 1 行追加（**name** と **invite_code** を任意の文字列で入力。招待コードは通常アプリのグループ作成で自動発行される）。通常はアプリの `/join` でこの招待コードを入力して参加する。
   - **Table Editor** で `group_members` を開く。上でコピーした user の **id** と、作った/既存の **group_id** の組み合わせが 1 行あれば OK。なければ「Insert row」で **group_id** と **user_id** を設定して追加するか、アプリの `/join` で招待コードを入力して参加する。

2. **tiles に 1 件挿入する**
   - **Table Editor** で `tiles` を開く → **Insert row**。
   - 次のように入力する（UUID は 1 で控えた値に置き換える）:
     - **h3_index:** 例として新宿付近の H3（Resolution 7）: `872830828ffffff`
     - **group_id:** 自分が所属しているグループの UUID
     - **owner_id:** 自分の user ID（UUID）
     - **score:** `100`（濃く表示）。`50` なら半分の濃さ、`0` ならほぼ透明。
   - 必須カラムが他にあれば（例: `captured_at` など）、デフォルトや現在時刻で埋める。

3. **アプリで確認**
   - ブラウザで `http://localhost:3000` を開き、**ログインした状態**でトップの地図を表示する。
   - 新宿付近にズームすると、追加した H3 セルが緑の六角形で表示され、**score** が高いほど濃く見える。

**H3 インデックスを自分で決めたい場合:** [H3 Geo](https://h3geo.org/docs/core-library/restable/) の「Lat/Lng to H3」で緯度・経度・Resolution 7 を指定するとインデックスが得られる。または Node で `require('h3-js').latLngToCell(35.6896, 139.6917, 7)` を実行してもよい。

## データベース

Strava OAuth ログインでは `users` テーブルを使用するため、[supabase/README.md](../supabase/README.md) に従い、初期マイグレーションを適用した状態にしておく。
