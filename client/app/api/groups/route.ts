import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

/**
 * POST /api/groups
 * グループを新規作成し、作成者を group_members に追加する。
 * Body: { name: string, invite_code: string }
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  let body: { name?: string; invite_code?: string };
  try {
    body = (await request.json()) as { name?: string; invite_code?: string };
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "JSON の形式が不正です" },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const inviteCode =
    typeof body.invite_code === "string" ? body.invite_code.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "Bad Request", message: "グループ名を入力してください" },
      { status: 400 }
    );
  }
  if (!inviteCode) {
    return NextResponse.json(
      { error: "Bad Request", message: "招待コードを入力してください" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: newGroup, error: insertGroupError } = await supabase
    .from("groups")
    .insert({ name, invite_code: inviteCode })
    .select("id, name, invite_code")
    .single();

  if (insertGroupError) {
    if (insertGroupError.code === "23505") {
      return NextResponse.json(
        { error: "Conflict", message: "その招待コードはすでに使われています" },
        { status: 409 }
      );
    }
    console.error("groups insert error:", insertGroupError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "グループの作成に失敗しました" },
      { status: 500 }
    );
  }

  const { error: insertMemberError } = await supabase
    .from("group_members")
    .insert({ group_id: newGroup.id, user_id: userId });

  if (insertMemberError) {
    console.error("group_members insert error:", insertMemberError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "メンバー登録に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    group_id: newGroup.id,
    name: newGroup.name,
    invite_code: newGroup.invite_code,
  });
}
