# Strava Hex Turf

Strava API と H3 インデックス（Resolution 7）を利用したランナー向けの陣取り Web アプリケーション。日常のランニングルートを「可視化された陣取りゲーム」に変え、コース開拓と継続的な運動モチベーションを創出する。

詳細な要件定義は [docs/srd.md](docs/srd.md) を参照。

## テックスタック

| 領域 | 技術 |
|------|------|
| フロントエンド & API Gateway | Vercel (Next.js) |
| データベース & バックエンド | Supabase (PostgreSQL + PostGIS) |
| インフラ管理 | Terraform |
| H3 インデックス | h3-js (Resolution 7) |

## ディレクトリ構成

```
├── client/          # フロントエンド（Next.js App Router, Tailwind CSS）
├── backend-api/     # バックエンド API（Node.js, TypeScript）
├── batch/           # 定期実行処理
├── supabase/        # Supabase ローカル開発・マイグレーション
├── infra/           # Terraform（Vercel / Supabase）
└── docs/            # ドキュメント
```

## 前提条件

- Node.js 18+
- Docker Desktop（Supabase ローカル用）
- [Terraform](https://developer.hashicorp.com/terraform/install)（インフラ管理用）

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/h0tcl0g/strava-hex-turf.git
cd strava-hex-turf
```

### 2. バックエンド API

```bash
cd backend-api
npm install
npm run test
```

### 3. Supabase ローカル環境（オプション）

Docker が起動している状態で:

```bash
npx supabase start
npx supabase db reset
```

マイグレーション適用後、ローカルの DB 接続情報が表示される。

### 4. Terraform（インフラ）

```bash
cd infra
terraform init
# supabase_access_token, supabase_endpoint を terraform.tfvars または環境変数で設定
terraform plan
```

## 開発フロー

- フィーチャーブランチ（`feature/xxx`）で開発
- コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/) に従う
- PR 作成後、人間によるコードレビューを実施

## ライセンス

Private
