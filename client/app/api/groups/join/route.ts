import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

/**
 * POST /api/groups/join
 * 招待コードでグループに参加し、group_members にレコードを追加する。
 * Body: { invite_code: string }
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  let body: { invite_code?: string };
  try {
    body = (await request.json()) as { invite_code?: string };
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "JSON の形式が不正です" },
      { status: 400 }
    );
  }

  const inviteCode =
    typeof body.invite_code === "string" ? body.invite_code.trim() : "";
  if (!inviteCode) {
    return NextResponse.json(
      { error: "Bad Request", message: "招待コードを入力してください" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (groupError) {
    console.error("groups fetch error:", groupError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "グループの取得に失敗しました" },
      { status: 500 }
    );
  }

  if (!group?.id) {
    return NextResponse.json(
      { error: "Not Found", message: "招待コードに一致するグループがありません" },
      { status: 404 }
    );
  }

  const { error: insertError } = await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: userId,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Conflict", message: "すでにこのグループに参加しています" },
        { status: 409 }
      );
    }
    console.error("group_members insert error:", insertError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "参加処理に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, group_id: group.id });
}
