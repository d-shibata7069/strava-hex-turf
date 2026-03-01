import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import {
  SESSION_COOKIE_NAME,
  getSessionDestroyOptions,
} from "@/lib/session";
import { decryptStravaToken } from "@/lib/strava-token-crypto";

const STRAVA_DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize";

/**
 * DELETE /api/me
 * ログインユーザーのアカウントを完全に削除（退会）する。
 * 削除前に Strava の OAuth 連携（アクセス許可）を取り消す。
 * public.users を削除すると、FK の振る舞いにより group_members / activity_logs 等は CASCADE 削除、
 * tiles.owner_id は SET NULL となり空き地として残る。
 * 削除後はセッション Cookie を破棄し、クライアントはルート（/）へリダイレクトすること。
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

  // 削除前に Strava 認可解除を試行（成功・失敗にかかわらず退会処理は続行）
  const { data: userRow } = await supabase
    .from("users")
    .select("strava_access_token")
    .eq("id", userId)
    .single();

  const encryptedToken = userRow?.strava_access_token;
  if (encryptedToken) {
    const accessToken = decryptStravaToken(encryptedToken);
    if (accessToken) {
      try {
        await fetch(STRAVA_DEAUTHORIZE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ access_token: accessToken }).toString(),
        });
      } catch (e) {
        console.error("Strava deauthorize request failed:", e);
      }
    }
  }

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
