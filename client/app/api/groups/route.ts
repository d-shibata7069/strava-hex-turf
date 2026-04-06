import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

/**
 * POST /api/groups
 * グループ新規作成をバックエンドAPI (BFF) に委譲する。
 * Body: { name: string } のみ。BFF へは { name, user_id } を送信。
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

  const backendUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "") ?? "";
  if (!backendUrl) {
    console.error("POST /api/groups: BACKEND_API_URL is not configured");
    return NextResponse.json(
      { error: "Internal Server Error", message: "サーバー設定エラーです" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${backendUrl}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, user_id: userId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        typeof data?.message === "string"
          ? data.message
          : "グループの作成に失敗しました";
      return NextResponse.json(
        { error: data?.error ?? "Internal Server Error", message },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("POST /api/groups: BFF request failed:", e);
    return NextResponse.json(
      { error: "Internal Server Error", message: "グループの作成に失敗しました" },
      { status: 500 }
    );
  }
}
