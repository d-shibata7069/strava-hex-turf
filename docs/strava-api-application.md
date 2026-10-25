# Strava API 制限引き上げ / Developer Program 申請文面（下書き）

本書は、Strava API の制限引き上げ（接続アスリート数の拡大）および Developer Program 審査への申請文面の**下書き**です。**提出は行っていません。** 提出前に、本人が「不足項目リスト」の項目を埋め／確認してください。

記載内容は実装実態に基づいており、実装していない機能は記載していません。数値の見積もりは事実に基づく値が未確定のため、プレースホルダ（`[要記入]`）としています。

---

## 0. 基本情報 / Basic Information

| 項目 | 内容 |
| --- | --- |
| アプリ名 / App name | strava-hex-turf |
| 本番 URL / Production URL | `[要記入]`（未確定。一般公開はまだ行っていません） |
| Strava Client ID | `[要記入]` |
| プライバシーポリシー / Privacy Policy | [docs/privacy-policy.md](privacy-policy.md)（公開 URL は `[要記入]`） |
| リポジトリ / Repository | https://github.com/d-shibata7069/strava-hex-turf |
| 現在の接続アスリート数 / Current connected athletes | `[要確認]`（現時点の上限は開発者本人 1 人のみ。一般公開はしていません） |
| 開発者の Strava サブスクリプション状態 / Developer's Strava subscription status | `[要確認]` |

---

## 1. アプリ説明 / App Description

### 日本語

strava-hex-turf は、Strava に記録されたランニングアクティビティを、Uber H3（Resolution 7）の六角タイルの「陣取りゲーム」に変換する Web アプリです。

ランナーが Strava にアクティビティをアップロードすると、Webhook 経由で自動的に通過エリアのタイルの所有権がそのランナーに移ります。タイルのスコアは 30 日かけて減衰し、同じグループの他のメンバーが同じタイルを走ると所有権が移ります。ユーザーは招待コード制のグループを作り／参加し、グループ内でマップ、ランキング、Activity Log（誰がどこを奪取・防衛したかの履歴）を共有します。

目的は、日常のランニングルートを可視化された陣取りゲームに変え、コース開拓と継続的な運動のモチベーションを高めることです。

対象種目はランニング系（`Run` / `TrailRun` / `VirtualRun`）です。手動で作成されたアクティビティやトレーナー（屋内）アクティビティは、陣取り判定の対象外としています。

現在の開発ステータスを正直に申し添えます。本サービスは開発中であり、一般公開はしていません。現時点では接続アスリート数の上限は開発者本人 1 人のみです。今回の申請は、公開に向けて接続アスリート数の上限引き上げをお願いするものです。

### English

strava-hex-turf is a web application that turns running activities recorded on Strava into a turf-claiming game played on hexagonal tiles (Uber H3, resolution 7).

When a runner uploads an activity to Strava, a webhook automatically transfers ownership of the tiles covering the route to that runner. A tile's score decays linearly over 30 days, and ownership moves when another member of the same group runs through the tile. Users create or join invite-code groups and share the map, a leaderboard, and an Activity Log (a history of who captured or defended which tile) within their group.

The goal is to turn everyday running routes into a visible turf game, encouraging route exploration and sustained motivation to keep running.

Supported sport types are running only (`Run` / `TrailRun` / `VirtualRun`). Manual activities and trainer (indoor) activities are excluded from turf calculation.

To be transparent about our current status: the service is under development and is not yet publicly available. The current connected-athlete limit is one — the developer alone. This application requests an increase of that limit in preparation for a public launch.

---

## 2. Strava データの利用目的 / How We Use Strava Data

### 日本語

Strava データは、陣取りゲームの提供のためだけに利用します。具体的には、(1) Webhook でアクティビティの作成・更新・削除を受け取り、該当アクティビティの GPS から通過タイルを算出して所有権とスコアを更新すること、(2) グループ内での表示名・アイコン、ランキング、Activity Log の表示、(3) 初回連携時に過去 7 日分のアクティビティを取り込み、初期の陣地を反映すること、です。

生の GPS 系列（`summary_polyline`）そのものはデータベースに保存しません。処理時にデコードして H3 セルへ変換し、保存するのはタイル所有権等の派生データです（詳細は「5. 派生データの保持について」）。

データを第三者のマーケティングまたは商業目的で販売・貸与・共有することはしません。

### English

Strava data is used solely to provide the turf game: (1) receiving activity create/update/delete events via webhook and computing passed tiles from the activity's GPS data to update tile ownership and scores; (2) displaying names/icons, the leaderboard, and the Activity Log within a group; and (3) importing the last 7 days of activities at first connection to seed the user's initial turf.

We do not store the raw GPS track (the `summary_polyline`) itself in our database. It is decoded at processing time and converted into H3 cells; what we store is derived data such as tile ownership (see Section 5).

We do not sell, rent, or share user data with third parties for their marketing or commercial purposes.

---

## 3. 要求スコープと利用目的・保持／削除方針 / Requested Scopes

[docs/README.md](README.md) の「Strava OAuth スコープ別 データ取得・利用・保持ポリシー」表と整合させています。

| Scope | 取得データ / Data obtained | 利用目的 / Purpose | 保持 / 削除方針 / Retention & deletion |
| --- | --- | --- | --- |
| `read` | アスリートの公開プロフィール（表示名、プロフィール画像、Strava athlete ID） / Public athlete profile (display name, profile image, Strava athlete ID) | ログイン中ユーザーの識別、グループ表示名・アイコン表示、ランキング表示 / Identifying the signed-in user; display names/icons in groups; leaderboard display | Supabase に保存。アカウント削除時に削除 / Stored in Supabase; deleted when the user deletes their account |
| `activity:read` | 公開アクティビティのメタデータ・GPS（距離、時刻、緯度経度系列） / Public activity metadata and GPS (distance, time, lat/lng series) | H3 タイルの奪取／防衛判定、スコア計算、Activity Log 表示 / Tile capture/defense decisions, score calculation, Activity Log display | ゲーム進行に必要な範囲で保存。アカウント削除時に活動由来データ（タイル履歴・ログ）を削除 / Stored only as needed for the game; activity-derived data (tile history, logs) is deleted on account deletion |
| `activity:read_all` | 非公開アクティビティを含むアクティビティデータ / Activity data including private activities | 現在要求しています。Webhook で受け取るアクティビティには非公開のものも含まれ、それらも陣取り判定の処理対象になるためです。あわせて `privacy_zone` が設定されている場合は、そのゾーン内の H3 セルを領地化対象から除外します / Currently requested. Activities delivered via webhook may be private, and those activities are also processed for turf calculation. When a `privacy_zone` is set, H3 cells inside the zone are excluded from turf capture | ゲーム進行に必要な範囲で保存（プライバシーゾーン内のセルは保存しない）。アカウント削除時に活動由来データを削除 / Stored only as needed for the game (cells inside a privacy zone are never stored); activity-derived data is deleted on account deletion |

補足 / Notes:

- 日本語: 実際の認可ルートで要求するスコープ文字列は `read,activity:read_all` です。
- English: The scope string actually requested by our authorization route is `read,activity:read_all`.
- 日本語: Strava のアクセス／リフレッシュトークンは AES-256-GCM で暗号化して保存し、平文では保存しません。
- English: Strava access/refresh tokens are stored encrypted with AES-256-GCM and are never stored in plaintext.

---

## 4. 表示範囲の説明 / Who Can See the Data

### 日本語

タイル（陣地）、ランキング、Activity Log は、いずれも**同一グループのメンバー内でのみ**表示される設計です。タイル取得等の API では、リクエストしたユーザーのセッションとグループ所属（メンバーシップ）を検証し、所属していないグループのデータは返しません。グループに参加していないユーザーや、一般の第三者に対して、他ユーザーのアクティビティ由来データを表示する仕様にはなっていません。

この表示範囲の設計が Strava API Policy の他者データ表示に関する条項に適合するかについては、私たちの理解だけで断定せず、**審査においてご確認・ご指摘いただければ幸いです**。必要であれば、指摘に沿って表示範囲や表示項目を調整する用意があります。

### English

Tiles, the leaderboard, and the Activity Log are each designed to be visible **only to members of the same group**. Our APIs verify the requesting user's session and group membership, and do not return data for groups the user does not belong to. We do not display one user's activity-derived data to non-members or to the general public.

We do not assert on our own authority that this visibility design satisfies the Strava API Policy provisions on displaying other athletes' data; **we respectfully ask the review team to confirm this point**, and we are prepared to adjust the visibility scope or displayed fields in line with any guidance we receive.

---

## 5. 派生データの保持について / Retention of Derived Data

### 日本語

本サービスが Strava データから生成して保持する派生データは、主に次のものです。

- GPS（`summary_polyline`）から変換した **H3 タイルの所有権**（H3 インデックス、所有者、グループ、スコア、最終更新日時）
- **ゲームログ**（Activity Log: グループ、ユーザー、アクション種別（奪取／防衛等）、H3 インデックス、メッセージ、日時）
- アクティビティとタイルの対応関係（`activity_tiles`: アクティビティ ID、ユーザー、H3 インデックス、グループ）。Strava 側でアクティビティが削除された場合に、影響タイルを再計算するために保持します
- 日次統計（ユーザー・グループごとのタイル数・スコアのスナップショット）

保持と削除に関する方針:

- 生の GPS 系列そのものは保存しません。保存するのは上記の派生データのみです。
- 派生データは、アカウントが存続する間、ゲームの進行（所有権・スコア・履歴の表示）のために保持します。
- ユーザーがアカウントを削除した場合、当該ユーザーに紐づく派生データ（タイル、ゲームログ、`activity_tiles`、日次統計を含む）は、外部キー制約（ON DELETE CASCADE）により関連データとともに削除します。
- ユーザーが Strava 側で連携を解除した場合も、Webhook の連携解除イベントを受けて同様にユーザーデータを削除します。
- Strava 側で個別のアクティビティが削除された場合は、当該アクティビティ由来の `activity_tiles` を削除し、影響を受けたタイルの所有権を残りのアクティビティから再計算します。
- プライバシーゾーンが設定されているユーザーの場合、ゾーン内の GPS からはタイルを生成せず、派生データとしても保存しません。なお、ゾーン設定用 UI は未実装であり（バックエンドの除外仕組みのみ実装済み）、現状は通常の利用でゾーンが設定される経路はありません。この点も含め、派生データの保持方針について審査でのご確認をお願いできれば幸いです。

### English

The derived data we generate from Strava data and retain consists mainly of:

- **H3 tile ownership** converted from GPS (`summary_polyline`): H3 index, owner, group, score, and last-updated time
- **Game logs** (Activity Log): group, user, action type (capture/defense, etc.), H3 index, message, and timestamp
- The activity-to-tile mapping (`activity_tiles`: activity ID, user, H3 index, group), retained so that affected tiles can be recomputed if an activity is deleted on Strava
- Daily statistics (per-user, per-group snapshots of tile counts and scores)

Retention and deletion policy:

- We do not store the raw GPS track itself; only the derived data above is stored.
- Derived data is retained while the account exists, as needed to run the game (ownership, scores, history display).
- When a user deletes their account, the derived data tied to that user (including tiles, game logs, `activity_tiles`, and daily statistics) is deleted together with the related records via foreign-key constraints (ON DELETE CASCADE).
- The same deletion occurs when a user disconnects the app on Strava, via the deauthorization webhook event.
- If an individual activity is deleted on Strava, we delete that activity's `activity_tiles` rows and recompute ownership of the affected tiles from the remaining activities.
- For a user with a privacy zone configured, no tiles are generated from GPS inside the zone, and nothing derived from it is stored. Please note that the UI for configuring a privacy zone is not yet implemented (only the backend exclusion mechanism is), so there is currently no in-app path by which a zone gets set. We would welcome the review team's confirmation of this derived-data retention approach as well.

---

## 6. 想定アスリート数とリクエスト量の見積もり / Expected Athletes and Request Volume

事実に基づく数値が未確定のため、以下はプレースホルダです。提出前に本人が実態と計画に基づいて記入してください。根拠のない数値は記載しません。

| 項目 | 値 |
| --- | --- |
| 想定接続アスリート数（公開後 ○ か月時点） / Expected connected athletes | `[要記入]` |
| 希望する接続アスリート数の上限 / Requested athlete limit | `[要記入]` |
| 想定 DAU / Expected daily active users | `[要記入]` |
| Strava API リクエスト量の見積もり（Webhook 経由のアクティビティ取得が中心。1 アクティビティ処理あたりの取得リクエスト数 × 1 日あたりの想定アクティビティ件数で算出すること） / Estimated API request volume | `[要記入]` |
| Webhook イベント量の見積もり（1 日あたり） / Estimated daily webhook events | `[要記入]` |
| レート制限への配慮（現状の実装事実） / Rate-limit considerations (implemented facts) | Webhook 駆動で処理し、定期的なポーリングによるアクティビティ取得は行いません。初回連携時のみ過去 7 日分を取得します |

---

## 7. セキュリティ対策（要約） / Security Measures (Summary)

### 日本語

- client から backend-api への内部呼び出しは共有キー（`INTERNAL_API_KEY`、`x-internal-api-key` ヘッダ、定数時間比較）で認証し、未設定時は全リクエストを拒否します（fail closed）。
- Webhook POST は、ペイロードの `subscription_id` を登録済み購読 ID と照合し、未設定・不一致のイベントは処理しません（fail closed）。購読確認 GET は verify token を照合します。
- データベースは全対象テーブルで Row Level Security を有効化し、タイル取得はセッション＋メンバーシップ検証を行う API 経由に限定しています。SECURITY DEFINER 関数の実行権限は `service_role` のみに制限しています。
- Strava トークンは AES-256-GCM で暗号化して保存します。
- Webhook 処理では、アクティビティの athlete ID とイベントの `owner_id` の照合、対象種目の制限、手動／トレーナーアクティビティの除外、速度とポリライン乖離の妥当性検証を行い、異常なアクティビティはタイル化しません。

### English

- Internal calls from the client to backend-api are authenticated with a shared key (`INTERNAL_API_KEY`, sent as the `x-internal-api-key` header, compared in constant time); if it is not configured, all requests are rejected (fail closed).
- Webhook POST events are checked against the registered subscription ID; events with a missing or mismatched `subscription_id` are not processed (fail closed). The subscription verification GET checks the verify token.
- Row Level Security is enabled on all relevant database tables, and tile access is limited to APIs that verify the session and group membership. EXECUTE on SECURITY DEFINER functions is restricted to `service_role`.
- Strava tokens are stored encrypted with AES-256-GCM.
- Webhook processing validates each activity — athlete ID against the event's `owner_id`, allowed sport types, exclusion of manual/trainer activities, and speed / polyline-divergence sanity checks — and does not convert anomalous activities into tiles.

---

## 不足項目リスト（提出前に本人が埋める／確認する項目）

- [ ] 本番 URL — 本番ドメインが未確定。一般公開用の URL が決まっていないと、申請の基本情報と Callback Domain を確定できない
- [ ] Strava Client ID — 申請対象のアプリを特定するために必要。リポジトリには記載していないため、本人が Strava のアプリ設定から転記する
- [ ] スクリーンショット — 未撮影。マップ、グループ、ランキング、Activity Log、ログイン／連携、設定／アカウント削除、プライバシーポリシーの画面が必要（[docs/launch-checklist.md](launch-checklist.md) 参照）
- [ ] 開発者の Strava サブスクリプション状態 — 未確認。API の利用条件・申請要件に関わるため、本人が確認して記録する
- [ ] 現在の接続アスリート数 — 「上限は開発者本人 1 人のみ」という現状は把握しているが、申請時点の正確な接続数は本人が Strava 側で確認する
- [ ] 想定アスリート数とリクエスト量の見積もり（本書「6.」の `[要記入]` 欄） — 根拠のある数値が必要であり、事実でない数値を下書きでは記載していない
- [ ] Webhook 購読の本番登録と subscription_id — 本番 callback_url での購読登録が済んでいないと、申請後に公開してもゲームが動作しない
- [ ] プライバシーポリシーの公開 URL — 文書版（[docs/privacy-policy.md](privacy-policy.md)）は作成済みだが、申請に記載できる公開 URL は本番デプロイ後に確定する
- [ ] アプリ内プライバシーポリシー／ログイン文面のスコープ表記の修正 — 現文面は「`activity:read_all` は要求していない」と記載しており、実装（`read,activity:read_all` を要求）と一致していない。提出前に文面を実態へ合わせること
- [ ] Strava Brand 準拠の対応状況 — 公式「Connect with Strava」ボタンへの差し替え、Compatible with Strava 表記、View on Strava リンク、帰属表示はいずれも未対応（現状は自作ボタン）。申請前に [docs/launch-checklist.md](launch-checklist.md) の Brand 準拠項目を確認する
