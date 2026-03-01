import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/groups/[id]/members/me
 * 現在のユーザーをグループから退会させる（group_members から自身の行を削除）。
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

  const { error: deleteError } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (deleteError) {
    console.error("group_members delete error:", deleteError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "退会処理に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
