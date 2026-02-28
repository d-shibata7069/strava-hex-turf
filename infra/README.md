# Terraform インフラ

Vercel と Supabase のプロビジョニングを IaC で管理する。

## 前提条件

- [Terraform](https://developer.hashicorp.com/terraform/install) 1.5+
- Vercel API トークン（`terraform.tfvars` または環境変数）
- Supabase Personal Access Token（`terraform.tfvars` または環境変数）

## プロバイダー

| プロバイダー | 用途 |
|-------------|------|
| vercel/vercel | フロントエンド & API Gateway |
| supabase/supabase | データベース & バックエンド |

## セットアップ

```bash
terraform init
```

## 変数

`variables.tf` で定義。値は `terraform.tfvars` または `TF_VAR_*` 環境変数で設定。

| 変数 | 説明 |
|------|------|
| `vercel_api_token` | Vercel ダッシュボードで発行した API トークン |
| `supabase_access_token` | Supabase ダッシュボードで発行した Personal Access Token |

```bash
# 環境変数での設定例
export TF_VAR_vercel_api_token="your-token"
export TF_VAR_supabase_access_token="your-token"
terraform plan
```

## 実行

```bash
terraform plan   # 変更差分の確認
terraform apply  # 適用（要確認）
```

## 参考

- [Vercel Terraform Guide](https://vercel.com/guides/integrating-terraform-with-vercel)
- [Supabase Terraform](https://supabase.com/docs/guides/deployment/terraform/reference)
