# Strava陣取りWebサービス インフラ初期設定
# docs/srd.md: Vercel + Supabase のIaC構成

terraform {
  required_version = ">= 1.0"
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.0"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
  }
}

# Vercel: フロントエンド & API Gateway
# VERCEL_API_TOKEN 環境変数で認証
provider "vercel" {
  # api_token は環境変数 VERCEL_API_TOKEN から自動読み込み
  # @see https://vercel.com/guides/integrating-terraform-with-vercel
}

# Supabase: データベース & バックエンド
# @see https://supabase.com/docs/guides/deployment/terraform/reference
variable "supabase_access_token" {
  description = "Supabase Personal Access Token（ダッシュボードで発行）"
  type        = string
  sensitive   = true
}

variable "supabase_endpoint" {
  description = "Supabase API エンドポイント（例: https://api.supabase.com）"
  type        = string
}

provider "supabase" {
  access_token = var.supabase_access_token
  endpoint     = var.supabase_endpoint
}
