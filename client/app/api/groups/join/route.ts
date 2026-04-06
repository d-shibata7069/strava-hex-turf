import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

/**
 * POST /api/groups/join
 * 招待コードでグループ参加をバックエンドAPI (BFF) に委譲する。
 * Body: { invite_code: string }。BFF へは { invite_code, user_id } を送信。
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

  const backendUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "") ?? "";
  if (!backendUrl) {
    console.error("POST /api/groups/join: BACKEND_API_URL is not configured");
    return NextResponse.json(
      { error: "Internal Server Error", message: "サーバー設定エラーです" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${backendUrl}/groups/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: inviteCode, user_id: userId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        typeof data?.message === "string"
          ? data.message
          : "参加処理に失敗しました";
      return NextResponse.json(
        { error: data?.error ?? "Internal Server Error", message },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("POST /api/groups/join: BFF request failed:", e);
    return NextResponse.json(
      { error: "Internal Server Error", message: "参加処理に失敗しました" },
      { status: 500 }
    );
  }
}
