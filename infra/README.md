# infra（インフラ）

Terraform で Vercel および Supabase のプロビジョニングを管理。構成の詳細は [docs/srd.md](../docs/srd.md) を参照。

## 前提

- Terraform 1.0 以上
- **Vercel:** 環境変数 `VERCEL_API_TOKEN` で認証（[Vercel + Terraform](https://vercel.com/guides/integrating-terraform-with-vercel) を参照）
- **Supabase:** 変数 `supabase_access_token`（Personal Access Token）、`supabase_endpoint`（例: `https://api.supabase.com`）を設定

## 実行

- 初期化: `terraform init`
- 計画: `terraform plan`
- 適用: `terraform apply`

変数は `terraform.tfvars` または `-var` で指定する。詳細は [main.tf](main.tf) を参照。
