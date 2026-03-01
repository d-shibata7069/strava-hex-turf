import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

/** GET レスポンスの1件の型（get_group_leaderboard RPC の戻り値） */
export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  icon_url: string | null;
  tile_count: string;
  total_score?: string;
}

/**
 * GET /api/groups/[id]/leaderboard
 * 指定グループ内のユーザーごとの獲得タイル数ランキングを返す。
 * 呼び出し元がそのグループのメンバーである場合のみ実行可能。
 * 集計は Supabase RPC get_group_leaderboard で DB 側で実施する。
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
      { error: "Forbidden", message: "このグループのメンバーではないためランキングを参照できません" },
      { status: 403 }
    );
  }

  const { data: rows, error: rpcError } = await supabase.rpc("get_group_leaderboard", {
    target_group_id: groupId,
  });

  if (rpcError) {
    console.error("get_group_leaderboard RPC error:", rpcError);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "ランキングの取得に失敗しました",
        detail: rpcError.message,
      },
      { status: 500 }
    );
  }

  const list = Array.isArray(rows) ? rows : [];
  return NextResponse.json(list as LeaderboardEntry[]);
}
