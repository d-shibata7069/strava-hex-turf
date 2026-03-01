import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/[id]/tiles
 * 指定グループに紐づく tiles のみを返す。呼び出し元がそのグループのメンバーである場合のみ実行可能。
 * グループごとに地図を表示する用途で使用する（h3_index の重複なし）。
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const { id: groupId } = await params;
  if (!groupId) {
    return NextResponse.json(
      { error: "Bad Request", message: "グループ ID がありません" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: member, error: memberError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    console.error("group_members fetch error:", memberError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "確認に失敗しました" },
      { status: 500 }
    );
  }

  if (!member) {
    return NextResponse.json(
      { error: "Forbidden", message: "このグループのメンバーではないためタイルを参照できません" },
      { status: 403 }
    );
  }

  const { data: tilesRaw, error: tilesError } = await supabase
    .from("tiles")
    .select("h3_index, owner_id, score, group_id, users!owner_id(icon_url)")
    .eq("group_id", groupId);

  if (tilesError) {
    console.error("tiles fetch error:", tilesError);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "タイルの取得に失敗しました",
        detail: tilesError.message,
      },
      { status: 500 }
    );
  }

  const tiles = (tilesRaw ?? []).map(
    (row: {
      h3_index: string;
      owner_id: string;
      score: number;
      group_id: string;
      users?: { icon_url: string | null } | { icon_url: string | null }[] | null;
    }) => {
      const users = row.users;
      const iconUrl =
        users == null
          ? null
          : Array.isArray(users)
            ? users[0]?.icon_url ?? null
            : users.icon_url ?? null;
      return {
        h3_index: row.h3_index,
        owner_id: row.owner_id,
        score: row.score,
        group_id: row.group_id,
        icon_url: iconUrl,
      };
    }
  );

  return NextResponse.json(tiles);
}
