import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

/** GET /api/tiles: ログインユーザーが所属するグループのタイル一覧を返す（RLS相当をAPI側で実施） */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: memberships, error: membersError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (membersError) {
    console.error("group_members fetch error:", membersError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "グループ取得に失敗しました" },
      { status: 500 }
    );
  }

  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (groupIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: tiles, error: tilesError } = await supabase
    .from("tiles")
    .select("h3_index, owner_id, score, group_id")
    .in("group_id", groupIds);

  if (tilesError) {
    console.error("tiles fetch error:", tilesError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "タイル取得に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json(tiles ?? []);
}
