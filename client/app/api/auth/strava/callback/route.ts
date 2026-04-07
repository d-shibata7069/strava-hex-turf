import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import {
  getStravaAuthStateDestroyOptions,
  STRAVA_AUTH_STATE_COOKIE_NAME,
} from "@/lib/stravaAuthState";

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

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const receivedState = searchParams.get("state");
  const storedState = request.cookies.get(STRAVA_AUTH_STATE_COOKIE_NAME)?.value;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const baseRedirect = appUrl.replace(/\/$/, "") || "http://localhost:3000";

  if (error === "access_denied") {
    return clearAuthState(NextResponse.redirect(`${baseRedirect}/login?error=denied`));
  }

  if (!receivedState || !storedState || receivedState !== storedState) {
    console.warn("Strava OAuth state validation failed");
    return clearAuthState(
      NextResponse.redirect(`${baseRedirect}/login?error=state_mismatch`),
    );
  }

  if (!code) {
    return clearAuthState(NextResponse.redirect(`${baseRedirect}/login?error=no_code`));
  }

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return clearAuthState(NextResponse.redirect(`${baseRedirect}/login?error=config`));
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
      return clearAuthState(
        NextResponse.redirect(`${baseRedirect}/login?error=token_exchange`),
      );
    }

    tokenData = (await tokenRes.json()) as StravaTokenResponse;
  } catch (e) {
    console.error("Strava token request error:", e);
    return clearAuthState(
        NextResponse.redirect(`${baseRedirect}/login?error=token_exchange`),
      );
  }

  const athlete = tokenData.athlete;
  if (!athlete?.id) {
    return clearAuthState(NextResponse.redirect(`${baseRedirect}/login?error=no_athlete`));
  }

  const displayName = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || `User ${athlete.id}`;
  const iconUrl = athlete.profile ?? athlete.profile_medium ?? null;
  const expiresAt = tokenData.expires_at != null ? new Date(tokenData.expires_at * 1000).toISOString() : null;

  const backendUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "") ?? "";
  if (!backendUrl) {
    console.error("User sync failed: BACKEND_API_URL is not configured");
    return clearAuthState(NextResponse.redirect(`${baseRedirect}/login?error=config`));
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(syncPayload),
    });
  } catch (e) {
    console.error("User sync request failed:", e);
    return clearAuthState(NextResponse.redirect(`${baseRedirect}/login?error=upsert`));
  }

  if (!syncRes.ok) {
    const text = await syncRes.text();
    console.error("User sync failed:", syncRes.status, text);
    return clearAuthState(NextResponse.redirect(`${baseRedirect}/login?error=upsert`));
  }

  let syncData: { id?: string; should_run_initial_backfill?: boolean };
  try {
    syncData = (await syncRes.json()) as { id?: string };
  } catch {
    console.error("User sync: invalid JSON response");
    return clearAuthState(NextResponse.redirect(`${baseRedirect}/login?error=upsert`));
  }

  if (!syncData?.id) {
    console.error("User sync: response missing id");
    return clearAuthState(NextResponse.redirect(`${baseRedirect}/login?error=upsert`));
  }

  if (syncData.should_run_initial_backfill === true) {
    const internalBackfillApiKey = process.env.INTERNAL_BACKFILL_API_KEY ?? "";
    if (!internalBackfillApiKey) {
      console.error("Initial backfill request failed: INTERNAL_BACKFILL_API_KEY is not configured");
      return NextResponse.redirect(`${baseRedirect}/login?error=config`);
    }

    try {
      const initialBackfillRes = await fetch(`${backendUrl}/users/initial-backfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-backfill-key": internalBackfillApiKey,
        },
        body: JSON.stringify({ strava_id: athlete.id }),
      });

      if (!initialBackfillRes.ok) {
        const text = await initialBackfillRes.text();
        console.error("Initial backfill request failed:", initialBackfillRes.status, text);
        return NextResponse.redirect(`${baseRedirect}/login?error=initial_backfill`);
      }
    } catch (e) {
      console.error("Initial backfill request failed:", e);
      return NextResponse.redirect(`${baseRedirect}/login?error=initial_backfill`);
    }
  }

  const token = await createSessionToken(syncData.id);
  const response = NextResponse.redirect(baseRedirect);
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return clearAuthState(response);
}
