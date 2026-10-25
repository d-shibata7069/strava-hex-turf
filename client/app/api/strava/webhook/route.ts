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
  subscription_id?: number;
  updates?: {
    authorized?: string | boolean;
  };
}

function getBackendBaseUrl(): string {
  return process.env.BACKEND_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

/** backend-api への内部呼び出し用ヘッダ */
function getInternalApiHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "",
  };
}

/**
 * A-2 / B-03: subscription_id の真正性検証。
 * Strava Webhook の POST には署名がないため、購読 ID の照合が実質的な防御線になる。
 * 環境変数未設定の場合も転送しない（fail closed）。
 */
function isValidSubscriptionId(subscriptionId: number | undefined): boolean {
  const expected = process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID;
  if (!expected) {
    console.error(
      "[strava-webhook] STRAVA_WEBHOOK_SUBSCRIPTION_ID is not configured; rejecting webhook event (fail closed)"
    );
    return false;
  }
  if (typeof subscriptionId !== "number") return false;
  return String(subscriptionId) === expected;
}

/**
 * Strava Webhook アクティビティ通知（POST）
 * object_type === 'activity' かつ aspect_type === 'create' のときは processActivityEvent、
 * aspect_type === 'delete' のときは processActivityDelete を backend-api で実行する。
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

  // subscription_id が一致しないイベントは backend へ転送しない
  if (!isValidSubscriptionId(body.subscription_id)) {
    return NextResponse.json(
      { error: "Invalid subscription_id" },
      { status: 403 }
    );
  }

  const { object_type, aspect_type, object_id, owner_id } = body;

  const isActivityEvent =
    object_type === "activity" &&
    typeof object_id === "number" &&
    typeof owner_id === "number" &&
    (aspect_type === "create" || aspect_type === "delete" || aspect_type === "update");

  if (isActivityEvent) {
    const url = `${getBackendBaseUrl()}/webhook/activity`;
    void fetch(url, {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({
        object_id,
        owner_id,
        ...(aspect_type === "delete"
          ? { action: "delete" }
          : aspect_type === "update"
            ? { action: "update" }
            : {}),
      }),
    }).catch((err) => {
      console.error("[strava-webhook] backend activity fetch error:", err);
    });
    return new NextResponse(null, { status: 200 });
  }

  const isDeauthorizationEvent =
    object_type === "athlete" &&
    typeof owner_id === "number" &&
    (aspect_type === "update" || aspect_type === "delete");

  if (isDeauthorizationEvent) {
    const url = `${getBackendBaseUrl()}/webhook/deauthorization`;

    try {
      const backendResponse = await fetch(url, {
        method: "POST",
        headers: getInternalApiHeaders(),
        // A-1: Strava ペイロードの updates.authorized をそのまま転送する（backend 側で false を確認する）
        body: JSON.stringify({ owner_id, authorized: body.updates?.authorized }),
      });

      if (!backendResponse.ok) {
        const errorBody = await backendResponse.text();
        console.error(
          "[strava-webhook] backend deauthorization failed:",
          backendResponse.status,
          errorBody
        );
        return NextResponse.json(
          { error: "Failed to process deauthorization event" },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error("[strava-webhook] backend deauthorization fetch error:", err);
      return NextResponse.json(
        { error: "Failed to process deauthorization event" },
        { status: 500 }
      );
    }
  }

  return new NextResponse(null, { status: 200 });
}
