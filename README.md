# strava-hex-turf

**Strava と H3 インデックスでつくる、ランナー向けの陣取り Web アプリ**

走ったルートを六角タイル（H3 Resolution 7）の「陣地」として可視化し、仲間と奪い合うゲームでランニングのモチベーションを高めます。

---

## このアプリでできること

- **Strava 連携** … 走行データを連携し、通過したエリアのタイルを自動で獲得
- **陣取りマップ** … 全体マップ（仲間の陣地）とパーソナルマップの切り替え
- **Activity Log** … 「誰がどこを奪取したか」などの履歴表示
- **プライバシーゾーン** … 自宅周辺などを指定し、陣取り対象から除外

詳細な仕様は [docs/srd.md](docs/srd.md)（プロダクト要件定義書）を参照。

---

## スクリーンショット・デモ

<!-- アプリの見た目（マップ画面・ログイン画面など）の画像をここに追加 -->

---

## 何から始めればいいか

| 目的                               | 参照先                                         |
| ---------------------------------- | ---------------------------------------------- |
| フロントエンドを動かす             | [client/README.md](client/README.md)           |
| データベース（Supabase）を用意する | [supabase/README.md](supabase/README.md)       |
| バックエンド API の開発・テスト    | [backend-api/README.md](backend-api/README.md) |
| 定期実行バッチ                     | [batch/README.md](batch/README.md)             |
| インフラ（Terraform）              | [infra/README.md](infra/README.md)             |
| 仕様・要件の確認                   | [docs/README.md](docs/README.md)               |

**共通:** Node.js 18 以上を推奨。各ディレクトリで `npm install` を実行してから開発を開始してください。

---

## リポジトリ構成（モノレポ）

| ディレクトリ  | 内容                                                      |
| ------------- | --------------------------------------------------------- |
| `client`      | フロントエンド（Next.js App Router, React, Tailwind CSS） |
| `backend-api` | バックエンド API（Node.js, TypeScript）                   |
| `batch`       | 定期実行処理                                              |
| `supabase`    | Supabase マイグレーション（SQL）                          |
| `infra`       | Terraform（Vercel / Supabase 等）                         |
| `docs`        | 仕様書（srd.md 等）                                       |
