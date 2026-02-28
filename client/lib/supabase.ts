import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * ブラウザ用 Supabase クライアント（anon key）。
 * クライアントコンポーネントやブラウザから利用する。
 */
export function getSupabaseBrowser(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * サーバー用 Supabase クライアント（service role key）。
 * API Route などサーバー側でのみ使用し、RLS をバイパスして users の Upsert 等を行う。
 * キーはサーバーにのみ配置すること。
 */
export function getSupabaseServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, serviceRoleKey);
}
