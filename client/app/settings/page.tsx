import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import { SettingsView } from "@/components/organisms";

/**
 * アカウント設定ページ。未ログイン時は /login へリダイレクトする。
 */
export default async function SettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("users")
    .select("display_name, icon_url")
    .eq("id", userId)
    .single();

  return (
    <SettingsView
      displayName={data?.display_name ?? null}
      iconUrl={data?.icon_url ?? null}
    />
  );
}
