# 公開・Strava 申請に向けた残件チェックリスト

一般公開と Strava API の制限引き上げ（接続アスリート数拡大）申請に向けて、残っている作業の一覧です。完了した項目にはチェックを入れてください。

> 現在のステータス: 開発中・**一般公開はしていない**。Strava アプリの接続アスリート数の上限は**開発者本人 1 人のみ**。

## デプロイ

- [ ] 本番ドメインを確定し、`NEXT_PUBLIC_APP_URL` をその HTTPS URL に設定する — Strava の Callback Domain と Webhook の callback_url は公開 URL を前提とするため、ドメインが決まらないと申請も連携確認もできないため
- [ ] backend-api の常時稼働ホスティングを選定し、デプロイする — Webhook 処理サーバーはイベント駆動で常時待ち受ける必要があり、ローカル／一時的な実行環境ではアクティビティを取りこぼすため
- [ ] backend-api を HTTPS 化し、client の `BACKEND_API_URL` にその `https` URL を設定する — 平文 http では Strava トークン等が経路上で漏洩するおそれがあるため（`client/.env.example` にも明記）
- [ ] client を Vercel 等へ本番デプロイし、Root Directory が `client` であることを確認する — モノレポ構成のため、設定を誤るとビルド／デプロイが失敗するため（[client/README.md](../client/README.md) のトラブルシューティング参照）
- [ ] backend-api と日次バッチの死活監視（ヘルスチェック／失敗通知）を設定する — Webhook 処理や減衰バッチの停止に気づけないと、ゲームデータが静かに壊れるため
- [ ] GitHub Actions の日次バッチ（`.github/workflows/daily-batch.yml`）に本番の `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` Secrets が設定されていることを確認する — Secrets 未設定ではスコア減衰が毎日失敗し続けるため

## データベース（Supabase）

- [ ] 本番 Supabase プロジェクトへ全マイグレーションを適用する（リポジトリルートで `make db-link` → `make db-push`） — スキーマ・RPC・RLS ポリシーはすべてマイグレーションで管理されており、未適用があると機能・セキュリティの前提が崩れるため
- [ ] 既存 DB がある場合は migration repair で履歴を付け替える（`supabase migration repair --status reverted 20250303120000` と `supabase migration repair --status applied 20260303120000`） — RLS マイグレーションの改名（`20250303120000` → `20260303120000`）により、既存 DB の `schema_migrations` に旧バージョンが残っていると履歴がずれるため。手順の出典は `supabase/migrations/20260303120000_enforce_rls.sql` 冒頭コメント
- [ ] `supabase migration list --linked` で Local と Remote の履歴が揃っていることを確認する — 「適用したつもり」で未適用のマイグレーションが残る事故を防ぐため
- [ ] 適用後の RLS 状態を確認する（全対象テーブルで RLS 有効、`tiles` に全件 SELECT ポリシーが無いこと、`activity_tiles` に anon / authenticated の権限が無いこと、SECURITY DEFINER 関数の EXECUTE が `service_role` のみであること） — 最終状態を保証する `20260407000000_security_hardening.sql` が意図どおり効いているかを、申請前に実物で裏取りするため
- [ ] anon キーでの直接アクセスを実際に試し、想定外に読めないことを確認する — ポリシー定義だけでなく実挙動で確認しないと、審査以前に情報漏洩リスクが残るため

## 環境変数

### client（本番環境）

- [ ] `SESSION_SECRET`（32 文字以上のランダム値） — セッション Cookie の署名鍵であり、弱い値ではセッションを偽造されるため
- [ ] `NEXT_PUBLIC_STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` — Strava OAuth に必須であり、誤ると全員がログインできないため
- [ ] `NEXT_PUBLIC_APP_URL`（本番ドメイン、末尾スラッシュなし） — OAuth の redirect_uri と Webhook callback_url の組み立てに使われるため
- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — DB 接続に必須であり、特に `service_role` はサーバー側のみで使うことをデプロイ設定でも守る必要があるため
- [ ] `STRAVA_TOKEN_ENCRYPTION_KEY`（32 バイトの base64、backend-api と同一値） — 未設定では Strava ログインが失敗し、値が backend とずれるとトークンを復号できないため
- [ ] `STRAVA_WEBHOOK_VERIFY_TOKEN` — Webhook 購読確認（GET）の照合に使い、購読作成時に Strava へ渡す値と一致させる必要があるため
- [ ] `STRAVA_WEBHOOK_SUBSCRIPTION_ID` — Webhook POST の真正性検証に必須であり、未設定では全イベントが拒否される（fail closed）ため
- [ ] `INTERNAL_API_KEY`（backend-api と同一値） — backend への内部呼び出し認証に必須であり、未設定・不一致では Webhook 転送や BFF が動かないため
- [ ] `INTERNAL_BACKFILL_API_KEY`（backend-api と同一値） — 初回連携時の過去 7 日分バックフィルに必要であるため
- [ ] `BACKEND_API_URL`（本番は `https` 必須） — Webhook 処理の転送先であり、平文 http はトークン漏洩リスクになるため

### backend-api（本番環境）

- [ ] `SUPABASE_URL`（または `NEXT_PUBLIC_SUPABASE_URL`） / `SUPABASE_SERVICE_ROLE_KEY` — Webhook 処理の DB 読み書きに必須であるため
- [ ] `STRAVA_TOKEN_ENCRYPTION_KEY`（client と同一値） — トークンの復号に必須であり、復号できないと Webhook 処理が停止するため
- [ ] `INTERNAL_API_KEY`（client と同一値） — 全 POST エンドポイントの内部認証に必須であり、未設定では全リクエストが拒否される（fail closed）ため
- [ ] `INTERNAL_BACKFILL_API_KEY`（client と同一値、後方互換用） — 初回バックフィル用キーでの呼び出しを受ける場合に必要であるため
- [ ] `PORT`（ホスティング側の指定がある場合） — 常時稼働ホスティングのポート規約に合わせないと起動できないため

### 共通

- [ ] 秘密情報（`STRAVA_CLIENT_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`、各種キー）がリポジトリにコミットされていないことを確認する — 公開リポジトリであるため、混入すると即座に漏洩になるため

## Strava アプリ設定

- [ ] Strava アプリ設定の Authorization Callback Domain に本番ドメインを登録する — 登録したドメイン以外への OAuth コールバックは Strava に拒否されるため
- [ ] Webhook 購読を本番 callback_url で登録する（client で `npm run webhook:subscribe`） — 購読がないとアクティビティの自動反映（ゲームの核）が一切動かないため
- [ ] 購読で発行された subscription_id を client の `STRAVA_WEBHOOK_SUBSCRIPTION_ID` に設定する — 設定しないと真正性検証で全 Webhook イベントが拒否されるため
- [ ] `npm run webhook:subscription:view` で現在の購読状態（callback_url、verify 状態）を確認する — 古い ngrok 等の callback_url の購読が残っていると、本番イベントが誤った宛先へ送られるため
- [ ] 現在の接続アスリート数を確認し、記録する — 制限引き上げ申請では現状の接続数と上限（現在は開発者本人 1 人のみ）が申請文面の前提になるため
- [ ] 開発者自身の Strava サブスクリプション状態を確認し、記録する — Strava API の利用条件・申請要件に関わるため、提出前に本人が確認する必要があるため
- [ ] アプリ内プライバシーポリシーとログイン説明のスコープ文面を実装実態に合わせて修正する（現文面は「`activity:read_all` は要求していない」と記載しているが、実装は `read,activity:read_all` を要求している） — 審査側がアプリ内文面・リポジトリ・申請文面を見比べたときに不整合があると、説明の信頼性を損なうため

## Brand 準拠（Strava Brand Guidelines）

- [ ] ログイン／連携ボタンを Strava 公式の「Connect with Strava」ボタン素材に差し替える — 現状は自作コンポーネント（`client/components/atoms/StravaConnectButton.tsx`、独自 SVG と独自スタイル）であり、公式ボタン素材の使用がガイドラインで求められるため
- [ ] 「Compatible with Strava」等の表記を、ガイドラインの定める文言・条件で掲載する — Strava との互換性を示す表記には定型文言と掲載条件があるため
- [ ] アクティビティやデータの表示箇所に「View on Strava」リンクを付ける — Strava 由来データには Strava 本体への導線（帰属リンク）が求められるため。現状、該当リンクは実装されていない
- [ ] Powered by Strava 等の帰属表示（アトリビューション）をフッター等に掲載する — Strava API の利用には帰属表示が求められるため。現状、該当表示は実装されていない
- [ ] Strava の名称・ロゴの使い方がガイドラインに沿っているか全体を確認する（サービス名やロゴで Strava 公式と誤認させないこと） — 公式サービスとの誤認はガイドライン違反であり、審査でも見られるため

## 申請素材

- [ ] スクリーンショットを撮影する（ログイン／Strava 連携、マップ、グループ、ランキング、Activity Log、設定／アカウント削除、プライバシーポリシー） — 審査側がサービスの実在とデータの使われ方を確認する主要素材であり、現状 README のスクリーンショット欄は「準備中」のため
- [ ] 申請文面 [docs/strava-api-application.md](strava-api-application.md) の `[要記入]` 項目を本人が埋める（本番 URL、Client ID、想定アスリート数、リクエスト量の見積もり等） — 数値や識別子は事実に基づく必要があり、開発者本人しか確定できないため
- [ ] 文書版プライバシーポリシー [docs/privacy-policy.md](privacy-policy.md) を公開 URL で閲覧できるようにする（アプリ内 `/privacy` ページの文面修正とあわせて） — 申請時にプライバシーポリシーの URL を求められることが多く、内容が実装実態と一致している必要があるため
- [ ] ルート README の内容が最新の実装実態と一致しているか最終確認する — 審査側がリポジトリを見る可能性が高く、誇張や古い記述は不信の材料になるため
- [ ] 利用規約・プライバシーポリシーのアプリ内ページが本番 URL で表示されることを確認する — 申請素材としてリンクを提出するページが実際に開けないと審査が進まないため
