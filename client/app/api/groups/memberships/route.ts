import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

/**
 * GET /api/groups/memberships
 * ログインユーザーが所属するグループ一覧を返す。
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: rows, error } = await supabase
    .from("group_members")
    .select("group_id, groups(name, invite_code)")
    .eq("user_id", userId);

  if (error) {
    console.error("group_members fetch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "取得に失敗しました" },
      { status: 500 }
    );
  }

  const memberships = (rows ?? []).map((r) => {
    const g = r.groups as { name?: string; invite_code?: string } | null;
    return {
      group_id: r.group_id,
      group_name: g?.name ?? null,
      invite_code: g?.invite_code ?? null,
    };
  });
  return NextResponse.json(memberships);
}
