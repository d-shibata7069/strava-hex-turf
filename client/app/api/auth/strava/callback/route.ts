import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookieOptions,
  getSessionDestroyOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import {
  getStravaAuthStateDestroyOptions,
  STRAVA_AUTH_STATE_COOKIE_NAME,
} from "@/lib/stravaAuthState";

import { getSupabaseServer } from "@/lib/supabase";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    profile: string | null;
    profile_medium?: string | null;
  };
}

export async function GET(request: NextRequest) {
  const clearAuthState = (response: NextResponse): NextResponse => {
    response.cookies.set(
      STRAVA_AUTH_STATE_COOKIE_NAME,
      "",
      getStravaAuthStateDestroyOptions(),
    );
    return response;
  };

  // A failed account switch must not leave the previous account authenticated.
  const failLogin = (reason: string): NextResponse => {
    const response = clearAuthState(
      NextResponse.redirect(`${baseRedirect}/login?error=${reason}`),
    );
    response.cookies.set(SESSION_COOKIE_NAME, "", getSessionDestroyOptions());
    return response;
  };

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const receivedState = searchParams.get("state");
  const storedState = request.cookies.get(STRAVA_AUTH_STATE_COOKIE_NAME)?.value;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const baseRedirect = appUrl.replace(/\/$/, "") || "http://localhost:3000";

  if (error === "access_denied") {
    return failLogin("denied");
  }

  if (!receivedState || !storedState || receivedState !== storedState) {
    console.warn("Strava OAuth state validation failed");
    return failLogin("state_mismatch");
  }

  if (!code) {
    return failLogin("no_code");
  }

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return failLogin("config");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  });

  let tokenData: StravaTokenResponse;
  try {
    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Strava token exchange failed:", tokenRes.status, text);
      return failLogin("token_exchange");
    }

    tokenData = (await tokenRes.json()) as StravaTokenResponse;
  } catch (e) {
    console.error("Strava token request error:", e);
    return failLogin("token_exchange");
  }

  const athlete = tokenData.athlete;
  if (!Number.isSafeInteger(athlete?.id) || athlete.id <= 0) {
    return failLogin("no_athlete");
  }

  const displayName = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || `User ${athlete.id}`;
  const iconUrl = athlete.profile ?? athlete.profile_medium ?? null;
  const expiresAt = tokenData.expires_at != null ? new Date(tokenData.expires_at * 1000).toISOString() : null;

  const backendUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "") ?? "";
  if (!backendUrl) {
    console.error("User sync failed: BACKEND_API_URL is not configured");
    return failLogin("config");
  }

  const syncPayload = {
    strava_id: athlete.id,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    display_name: displayName,
    profile_image_url: iconUrl,
    strava_token_expires_at: expiresAt,
  };

  let syncRes: Response;
  try {
    syncRes = await fetch(`${backendUrl}/users/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "",
      },
      body: JSON.stringify(syncPayload),
    });
  } catch (e) {
    console.error("User sync request failed:", e);
    return failLogin("upsert");
  }

  if (!syncRes.ok) {
    const text = await syncRes.text();
    console.error("User sync failed:", syncRes.status, text);
    return failLogin("upsert");
  }

  let syncData: { id?: string; should_run_initial_backfill?: boolean };
  try {
    syncData = (await syncRes.json()) as { id?: string };
  } catch {
    console.error("User sync: invalid JSON response");
    return failLogin("upsert");
  }

  if (typeof syncData?.id !== "string" || !syncData.id) {
    console.error("User sync: response missing id");
    return failLogin("upsert");
  }

  // Verify the UUID against the same database used by the client APIs.
  // This also works with backends that return only id, without a new API contract.
  try {
    const { data: syncedUser, error: identityError } = await getSupabaseServer()
      .from("users")
      .select("id, strava_id")
      .eq("id", syncData.id)
      .eq("strava_id", athlete.id)
      .maybeSingle();
    if (
      identityError ||
      syncedUser?.id !== syncData.id ||
      String(syncedUser?.strava_id) !== String(athlete.id)
    ) {
      console.error("Strava identity verification failed", {
        athlete_id: athlete.id,
        synced_user_id: syncData.id,
      });
      return failLogin("upsert");
    }
  } catch {
    console.error("Strava identity lookup failed");
    return failLogin("upsert");
  }

  if (syncData.should_run_initial_backfill === true) {
    const internalBackfillApiKey = process.env.INTERNAL_BACKFILL_API_KEY ?? "";
    if (!internalBackfillApiKey) {
      console.error("Initial backfill request failed: INTERNAL_BACKFILL_API_KEY is not configured");
      return failLogin("config");
    }

    try {
      const initialBackfillRes = await fetch(`${backendUrl}/users/initial-backfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-backfill-key": internalBackfillApiKey,
          "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "",
        },
        body: JSON.stringify({ strava_id: athlete.id }),
      });

      if (!initialBackfillRes.ok) {
        const text = await initialBackfillRes.text();
        console.error("Initial backfill request failed:", initialBackfillRes.status, text);
        return failLogin("initial_backfill");
      }
    } catch (e) {
      console.error("Initial backfill request failed:", e);
      return failLogin("initial_backfill");
    }
  }

  let token: string;
  try {
    token = await createSessionToken(syncData.id);
  } catch {
    console.error("Strava session creation failed");
    return failLogin("config");
  }
  const response = NextResponse.redirect(baseRedirect);
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return clearAuthState(response);
}
