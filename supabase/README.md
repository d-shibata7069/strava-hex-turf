# supabase（データベース・マイグレーション）

Supabase プロジェクトで PostgreSQL を利用。**スキーマ変更はすべて `migrations/` の SQL で管理し、Supabase CLI で適用する。** ダッシュボードの SQL Editor は基本的に使わない。

## 環境構築（コマンド一括）

### 初回だけ（ログイン＋紐付け）

```bash
make db-link PROJECT_REF=<プロジェクトID>
```

`<プロジェクトID>` は Supabase ダッシュボードの URL の `https://supabase.com/dashboard/project/<ここ>`。ブラウザでログインを促されたら完了するまで実行する。

### マイグレーション適用（毎回・CI でも可）

**リポジトリルート**で実行する:

```bash
make db-push
```

これだけで `migrations/` の未適用分が順にリモートに反映される。**カラム不足（例: `tiles.score` がない）も、未適用のマイグレーションがあればこの一コマンドで解消する。**

**注意:** `make db-push` は `cd supabase` せず、**プロジェクトルート**から `supabase db push --linked` を実行する。`cd supabase` してから push すると、リモート履歴との比較が正しく動かず「Remote database is up to date」のままになることがある。

### リモートのマイグレーション履歴が空で「アップデートされない」場合

過去にダッシュボードだけでスキーマを入れたなどで、リモートの `supabase_migrations.schema_migrations` に 1 件も無いことがある。その状態だと `db push` だけでは適用されない。

**対処（必ずリポジトリルートで実行）:**

Supabase CLI は **カレントディレクトリ** の `supabase/migrations/` を参照する。`supabase/` の中や別のディレクトリで実行すると `file does not exist` になる。

1. **プロジェクトルートに移動する:**  
   `cd ..`（`strava-hex-turf` の直下にいること）

2. 既に適用済みの分を履歴に登録する:

   ```bash
   supabase migration repair 20260228000000 --status applied --linked
   supabase migration repair 20260228100000 --status applied --linked
   ```

3. 未適用の 3 本目を適用する:

   ```bash
   make db-push
   ```

4. 状態確認: `supabase migration list --linked` で Local と Remote が揃っているか確認する。

---

## 手順の詳細（CLI を直接使う場合）

### 1. Supabase CLI のインストール

- **macOS (Homebrew):** `brew install supabase/tap/supabase`
- **npm:** `npm install -g supabase`
- その他: [Install the Supabase CLI](https://supabase.com/docs/guides/cli/getting-started#install-the-supabase-cli)

### 2. リモートプロジェクトへの紐付け（初回のみ）

```bash
make db-link PROJECT_REF=<PROJECT_REF>
```

または `supabase login` のあと `supabase link --project-ref <PROJECT_REF>`。**いずれもリポジトリルートで実行。**

### 3. マイグレーションの適用

```bash
make db-push
```

**リポジトリルートで実行すること。** `cd supabase` してから push すると反映されない場合がある。

### 4. 今後のスキーマ変更

- 新しいマイグレーションを追加する: `supabase migration new <名前>` で `migrations/` にファイルができるので、中身の SQL を書く。
- 適用: 同じく `make db-push`。

---

**補足:** 過去にダッシュボードの SQL Editor でだけ変更を入れた場合は、`supabase db pull` でリモートの状態をマイグレーションとして取り込める（[Managing environments](https://supabase.com/docs/guides/deployment/managing-environments) 参照）。以降はファイル＋CLI のみで管理できる。

## マイグレーションファイル

| ファイル                                                | 内容                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `20260228000000_initial_schema.sql`                     | 初期スキーマ（users, groups, group_members, tiles 等）       |
| `20260228100000_tiles_score_and_users_token.sql`        | tiles の score / last_updated_at、users の Strava トークン列 |
| `20260301000000_ensure_tiles_score_and_users_token.sql` | 上記カラムの冪等な追加（履歴未適用・手動のみ環境の救済用）   |
| `20250303120000_enforce_rls.sql`                        | RLS 一括有効化とポリシー定義（users / tiles / group_members 等） |

3 本目は `ADD COLUMN IF NOT EXISTS` のため、既にカラムがある DB では何も変わらない。**「column tiles.score does not exist」が出た場合も、`make db-push` で未適用の 3 本目が走れば解消する。**

## セキュリティ・RLSポリシー

Anon Key 経由の不正な読み書きを防ぐため、対象テーブルで Row Level Security（RLS）を有効化している。**Service Role Key は RLS をバイパスする**ため、バックエンドのみが書き込みを行う想定。

適用内容はマイグレーション `20250303120000_enforce_rls.sql` で定義されている。

| テーブル | RLS | クライアント（Anon/Authenticated）で可能な操作 | 条件・備考 |
| -------- | --- | ---------------------------------------------- | ---------- |
| **users** | 有効 | SELECT, UPDATE | 自分の行のみ。条件: `auth.uid() = id`。INSERT/DELETE はポリシーなし（バックエンドのみ）。 |
| **tiles** | 有効 | SELECT のみ | 全行読み取り可（`USING (true)`）。INSERT/UPDATE/DELETE はポリシーなしで、Service Role を持つバックエンドのみ書き込み可能。 |
| **group_members** | 有効 | SELECT のみ | 自分が所属しているレコードのみ。条件: `auth.uid() = user_id`。書き込みはバックエンドのみ。 |
| **groups** | 有効 | なし | ポリシーを付与していないため、Anon/Authenticated では行の参照・更新不可。必要ならバックエンド経由または別マイグレーションでポリシーを追加する。 |
| **activity_logs** | 有効 | なし | 上記と同様。クライアントからの直接アクセスは不可。 |

- 認証は Supabase Auth の `auth.uid()` を前提とする。
- クライアントからは Anon Key または Authenticated セッションで接続し、上記ポリシーの範囲内でのみアクセスできる。

## トラブルシューティング

### 「Could not find the 'strava_access_token' column」が出る（PGRST204）

**原因:** 2 本目のマイグレーション未適用か、PostgREST のスキーマキャッシュが古い。

**手順:**

1. **まず CLI で未適用マイグレーションを適用する:** リポジトリルートで `make db-push`（または `supabase db push --linked`）。
2. まだエラーになる場合、PostgREST のキャッシュ更新のため、ダッシュボードの **SQL Editor** で `NOTIFY pgrst, 'reload schema';` を実行し、数十秒待ってから再試行。

参考: [PostgREST not recognizing new columns](https://supabase.com/docs/guides/troubleshooting/postgrest-not-recognizing-new-columns-or-functions-bd75f5)

### 「column tiles.score does not exist」が出る

**原因:** 2 本目のマイグレーション（`tiles.score` / `last_updated_at` 追加）が未適用か、スキーマキャッシュが古い。

**手順:**

1. **CLI で適用:** リポジトリルートで `make db-push`（または `supabase db push --linked`）。
2. まだ出る場合: ダッシュボードの **SQL Editor** で `NOTIFY pgrst, 'reload schema';` を実行し、数十秒待ってから地図を再読み込み。
