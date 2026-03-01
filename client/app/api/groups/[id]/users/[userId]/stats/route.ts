import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string; userId: string }> };

export interface UserGroupDailyStat {
  record_date: string;
  tile_count: number;
  total_score: number;
}

/**
 * GET /api/groups/[id]/users/[userId]/stats
 * 指定ユーザーの user_group_daily_stats を日付昇順で返す。
 * グループメンバーのみ実行可能。実データのみ返し、データが無い場合は空配列。
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const currentUserId = await getSessionUserId();
  if (!currentUserId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const { id: groupId, userId: targetUserId } = await params;
  if (!groupId || !targetUserId) {
    return NextResponse.json(
      { error: "Bad Request", message: "グループIDまたはユーザーIDがありません" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: member, error: memberError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", currentUserId)
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
      { error: "Forbidden", message: "このグループのメンバーではないため参照できません" },
      { status: 403 }
    );
  }

  const { data: rows, error: statsError } = await supabase
    .from("user_group_daily_stats")
    .select("record_date, tile_count, total_score")
    .eq("user_id", targetUserId)
    .eq("group_id", groupId)
    .order("record_date", { ascending: true });

  if (statsError) {
    console.error("user_group_daily_stats fetch error:", statsError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "統計の取得に失敗しました", detail: statsError.message },
      { status: 500 }
    );
  }

  const list = Array.isArray(rows) ? rows : [];

  const normalized: UserGroupDailyStat[] = list.map((r) => ({
    record_date: typeof r.record_date === "string" ? r.record_date : (r.record_date as unknown as Date)?.toISOString?.()?.slice(0, 10) ?? "",
    tile_count: Number(r.tile_count) ?? 0,
    total_score: Number(r.total_score) ?? 0,
  }));

  return NextResponse.json(normalized);
}
