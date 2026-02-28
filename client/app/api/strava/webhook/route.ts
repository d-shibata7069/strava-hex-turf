import { NextRequest, NextResponse } from "next/server";

/**
 * Strava Webhook 購読確認（GET）
 * hub.verify_token を STRAVA_WEBHOOK_VERIFY_TOKEN と比較し、
 * 一致すれば backend-api の verifyWebhook と同様の結果（hub.challenge）を JSON で返す。
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const verifyToken = searchParams.get("hub.verify_token");
  const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  const challenge = searchParams.get("hub.challenge");

  if (
    typeof expectedToken !== "string" ||
    expectedToken === "" ||
    verifyToken !== expectedToken
  ) {
    return NextResponse.json(
      { error: "Invalid or missing verify_token" },
      { status: 403 }
    );
  }

  if (typeof challenge !== "string" || challenge === "") {
    return NextResponse.json(
      { error: "Missing or invalid hub.challenge" },
      { status: 400 }
    );
  }

  return NextResponse.json({ "hub.challenge": challenge });
}

/** Strava Webhook POST ボディ（本処理で利用するフィールドのみ） */
interface StravaWebhookPayload {
  object_type?: string;
  aspect_type?: string;
  object_id?: number;
  owner_id?: number;
}

/**
 * Strava Webhook アクティビティ通知（POST）
 * object_type === 'activity' かつ aspect_type === 'create' の場合のみ、
 * /backend-api の processActivityEvent を呼び出して非同期で処理を開始し、
 * 即座に 200 OK を返す（Strava の 2 秒タイムアウト制限を回避するため）。
 */
export async function POST(request: NextRequest) {
  let body: StravaWebhookPayload;
  try {
    body = (await request.json()) as StravaWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { object_type, aspect_type, object_id, owner_id } = body;

  if (
    object_type === "activity" &&
    aspect_type === "create" &&
    typeof object_id === "number" &&
    typeof owner_id === "number"
  ) {
    const baseUrl =
      process.env.BACKEND_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
    const url = `${baseUrl}/webhook/activity`;
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ object_id, owner_id }),
    }).catch((err) => {
      console.error("[strava-webhook] backend fetch error:", err);
    });
  }

  return new NextResponse(null, { status: 200 });
}
