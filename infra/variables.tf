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
