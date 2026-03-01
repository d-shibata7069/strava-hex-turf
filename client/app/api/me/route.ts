import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import {
  SESSION_COOKIE_NAME,
  getSessionDestroyOptions,
} from "@/lib/session";

/**
 * DELETE /api/me
 * ログインユーザーのアカウントを完全に削除（退会）する。
 * public.users を削除すると、FK の振る舞いにより group_members / activity_logs 等は CASCADE 削除、
 * tiles.owner_id は SET NULL となり空き地として残る。
 * 削除後はセッション Cookie を破棄し、クライアントは /login へリダイレクトすること。
 */
export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "アカウントの削除に失敗しました" },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", getSessionDestroyOptions());
  return response;
}
