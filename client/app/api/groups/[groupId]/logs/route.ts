import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

type RouteParams = { params: Promise<{ groupId: string }> };

/** GET レスポンスの1件の型 */
export interface ActivityLogEntry {
  id: string;
  group_id: string;
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
 * GET /api/groups/[groupId]/logs
 * 指定グループに紐づく activity_logs を新しい順で取得する。ユーザー情報（表示名・アイコン）を結合して返す。
 * 呼び出し元がそのグループのメンバーである場合のみ実行可能。
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const { groupId } = await params;
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
      { error: "Forbidden", message: "このグループのメンバーではないためログを参照できません" },
      { status: 403 }
    );
  }

  const { data: rows, error: logsError } = await supabase
    .from("activity_logs")
    .select(
      "id, group_id, user_id, action, h3_index, message, created_at, users(display_name, icon_url)"
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (logsError) {
    console.error("activity_logs fetch error:", logsError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "ログの取得に失敗しました", detail: logsError.message },
      { status: 500 }
    );
  }

  const logs: ActivityLogEntry[] = (rows ?? []).map((r) => {
    const row = r as {
      id: string;
      group_id: string;
      user_id: string;
      action: string;
      h3_index: string | null;
      message: string;
      created_at: string;
      users: { display_name: string | null; icon_url: string | null } | null;
    };
    return {
      id: row.id,
      group_id: row.group_id,
      user_id: row.user_id,
      action: row.action,
      h3_index: row.h3_index,
      message: row.message,
      created_at: row.created_at,
      user: row.users ?? null,
    };
  });

  return NextResponse.json(logs);
}
