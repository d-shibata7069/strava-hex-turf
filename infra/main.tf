terraform {
  required_version = ">= 1.5.0"

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

# --------------------------------------------------
# Vercel Provider
# --------------------------------------------------
provider "vercel" {
  api_token = var.vercel_api_token
}

# --------------------------------------------------
# Supabase Provider
# --------------------------------------------------
provider "supabase" {
  access_token = var.supabase_access_token
}

# --------------------------------------------------
# Variables
# --------------------------------------------------
variable "vercel_api_token" {
  description = "Vercel API token for authentication"
  type        = string
  sensitive   = true
}

variable "supabase_access_token" {
  description = "Supabase access token for authentication"
  type        = string
  sensitive   = true
}
