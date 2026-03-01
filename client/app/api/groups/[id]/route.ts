import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/groups/[id]
 * グループを削除する。呼び出し元がそのグループのメンバーである場合のみ実行可能。
 * グループ削除に伴い group_members / tiles は CASCADE で削除される。
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
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
      { error: "Forbidden", message: "このグループのメンバーではないため削除できません" },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);

  if (deleteError) {
    console.error("groups delete error:", deleteError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "グループの削除に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
