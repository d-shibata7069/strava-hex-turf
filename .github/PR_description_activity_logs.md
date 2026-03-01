# Pull Request 説明文（feature/activity-logs-timeline）

以下を GitHub の PR 作成画面の Description に貼り付けてください。

---

## 概要 (Context)

ユーザー同士の競争を促進するコア機能「Activity Log（タイムライン）」を実装しました。走行後に「〇〇が N 個の陣地を奪取・防衛しました」をグループメンバーに共有し、地図画面横のタイムラインで確認できるようにしています。

## 対応背景

- docs/srd.md の「Activity Log (履歴画面)」要件を満たすため
- 仲間内での優越感・コミュニケーションハブとしてのタイムラインを提供するため

## 変更内容 (Changes)

- **バックエンド（Webhook）**: `processActivityEvent` で tiles・activity_tiles の Upsert 完了後、今回の走行で更新した H3 タイル数をカウントし、`activity_logs` に「{ユーザー名} が {N}個の陣地を奪取・防衛しました！」を対象ユーザーの所属グループごとに 1 件ずつ Insert
- **ログ取得 API**: `GET /api/groups/[groupId]/logs` を新設。指定グループに紐づく `activity_logs` を `created_at` 降順で取得し、`users` を JOIN して表示名・アイコン URL を付与して返却
- **フロントエンド**: `ActivityTimeline` コンポーネントを追加。地図画面右側にオーバーレイでタイムラインを表示。ホームではログインユーザーの最初の所属グループのログを表示。Storybook 用に `initialLogs` でダミーログを注入可能
- **テスト**: `strava-webhook.test.ts` に activity_logs Insert の検証および display_name 空時の「ランナー」フォールバックのテストを追加

## 動作確認手順 (How to Test)

1. **バックエンドのテストが Pass すること**: `backend-api` で `npm test` を実行し、すべてのテストがパスすることを確認する
2. **ダミーログを DB に入れた際、フロントエンドのタイムラインに表示されること**: Supabase の `activity_logs` にダミーログを 1 件以上 Insert した状態で、該当グループに所属するユーザーでログインし、フロントエンドのホームを開き、地図右側のタイムラインにそのログが表示されることを確認する
3. （任意）Storybook で `Organisms/ActivityTimeline` の `WithMockLogs` を開き、ダミーログが表示されることを確認する

## 影響範囲と懸念事項 (Impact & Concerns)

- `activity_logs` への Insert は backend-api の Webhook 処理内で行うため、Supabase は service role で RLS をバイパスしており、新規ポリシーは不要
- ホームでは「最初の所属グループ」のログのみ表示。複数グループの切り替えは今後の拡張とする

## チェックリスト (Checklist)

- [x] 必要なテストコードを追加・更新し、すべてパスしている
- [x] VercelのPreview環境でUIの表示崩れがないか確認できる状態にある
- [ ] 環境変数（`.env`）の追加や変更が必要な場合、その旨を記載している
- [ ] 動作画面に変更がある場合、変更前後のスクリーンショットを載せている
