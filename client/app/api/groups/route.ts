import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

const INVITE_CODE_BYTES = 4; // 8 hex chars
const MAX_RETRIES = 5;

function generateInviteCode(): string {
  return randomBytes(INVITE_CODE_BYTES).toString("hex");
}

/**
 * POST /api/groups
 * グループを新規作成し、作成者を group_members に追加する。
 * 招待コードはサーバーで自動生成する（Body: { name: string } のみ）。
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "JSON の形式が不正です" },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "Bad Request", message: "グループ名を入力してください" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const inviteCode = generateInviteCode();
    const { data: newGroup, error: insertGroupError } = await supabase
      .from("groups")
      .insert({ name, invite_code: inviteCode })
      .select("id, name, invite_code")
      .single();

    if (!insertGroupError) {
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

    if (insertGroupError.code === "23505") {
      lastError = insertGroupError;
      continue;
    }
    console.error("groups insert error:", insertGroupError);
    return NextResponse.json(
      { error: "Internal Server Error", message: "グループの作成に失敗しました" },
      { status: 500 }
    );
  }

  console.error("groups insert conflict after retries:", lastError);
  return NextResponse.json(
    { error: "Conflict", message: "招待コードの生成に失敗しました。しばらくしてから再試行してください。" },
    { status: 409 }
  );
}
