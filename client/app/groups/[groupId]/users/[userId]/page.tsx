import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import { UserStatsView } from "@/components/organisms";
import { ChevronLeft } from "lucide-react";

type PageProps = { params: Promise<{ groupId: string; userId: string }> };

/**
 * グループ内ユーザー詳細ページ。
 * グループメンバーのみアクセス可能。ユーザー基本情報を取得して UserStatsView に渡す。
 */
export default async function GroupUserPage({ params }: PageProps) {
  const currentUserId = await getSessionUserId();
  if (!currentUserId) {
    redirect("/login");
  }

  const { groupId, userId } = await params;
  if (!groupId || !userId) {
    notFound();
  }

  const supabase = getSupabaseServer();

  const { data: myMember } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (!myMember) {
    return (
      <div className="p-4 text-center text-gray-600">
        このグループのメンバーではないため表示できません。
      </div>
    );
  }

  const { data: targetMember } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetMember) {
    notFound();
  }

  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, display_name, icon_url")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          マップに戻る
        </Link>
        <UserStatsView
          groupId={groupId}
          userId={user.id}
          displayName={user.display_name ?? "名前なし"}
          iconUrl={user.icon_url ?? null}
          groupName={group?.name ?? null}
        />
      </div>
    </main>
  );
}
