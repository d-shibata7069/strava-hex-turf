import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

/** GET レスポンスの1件の型（グループ名を含む） */
export interface MyActivityLogEntry {
  id: string;
  group_id: string;
  group_name: string | null;
  user_id: string;
  action: string;
  h3_index: string | null;
  message: string;
  created_at: string;
  user?: {
    display_name: string | null;
    icon_url: string | null;
  } | null;
}

/**
 * GET /api/me/activity-logs
 * ログインユーザーが参加している全グループの activity_logs を新しい順で返す。ヘッダー通知用。
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

  const { data: memberships, error: memberError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (memberError) {
    console.error("group_members fetch error:", memberError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "取得に失敗しました" },
      { status: 500 }
    );
  }

  const groupIds = (memberships ?? []).map((m) => m.group_id).filter(Boolean);
  if (groupIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: rows, error: logsError } = await supabase
    .from("activity_logs")
    .select(
      "id, group_id, user_id, action, h3_index, message, created_at, users(display_name, icon_url), groups(name)"
    )
    .in("group_id", groupIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (logsError) {
    console.error("activity_logs fetch error:", logsError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "ログの取得に失敗しました", detail: logsError.message },
      { status: 500 }
    );
  }

  const logs: MyActivityLogEntry[] = (rows ?? []).map((r) => {
    const row = r as {
      id: string;
      group_id: string;
      user_id: string;
      action: string;
      h3_index: string | null;
      message: string;
      created_at: string;
      users: { display_name: string | null; icon_url: string | null } | { display_name: string | null; icon_url: string | null }[] | null;
      groups: { name: string | null } | { name: string | null }[] | null;
    };
    const userRow = Array.isArray(row.users) ? row.users[0] ?? null : row.users;
    const groupRow = Array.isArray(row.groups) ? row.groups[0] ?? null : row.groups;
    return {
      id: row.id,
      group_id: row.group_id,
      group_name: groupRow?.name ?? null,
      user_id: row.user_id,
      action: row.action,
      h3_index: row.h3_index,
      message: row.message,
      created_at: row.created_at,
      user: userRow ?? null,
    };
  });

  return NextResponse.json(logs);
}
