import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/groups/[id]
 * グループを削除する。
 * - groups.created_by が設定されているグループは、作成者本人のみ削除可能（A-8）。
 * - created_by が NULL のレガシーグループ（カラム追加前に作られたもの）は作成者を
 *   特定できないため、従来通りメンバーであれば削除可能とする。
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

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("created_by")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    console.error("groups fetch error:", groupError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "確認に失敗しました" },
      { status: 500 }
    );
  }

  // created_by が設定されている場合は作成者本人のみ削除可。
  // NULL のレガシーグループは作成者を特定できないため、従来通りメンバー削除可とする。
  if (group?.created_by && group.created_by !== userId) {
    return NextResponse.json(
      { error: "Forbidden", message: "グループを削除できるのは作成者のみです" },
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
