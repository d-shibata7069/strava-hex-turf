import { NextResponse } from "next/server";
import {
  generateStravaAuthState,
  getStravaAuthStateCookieOptions,
  STRAVA_AUTH_STATE_COOKIE_NAME,
} from "@/lib/stravaAuthState";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";

export async function GET() {
  const state = generateStravaAuthState();
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const appUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") ||
    "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/strava/callback`;
  const scope = "read,activity:read_all";

  const params = new URLSearchParams({
    client_id: clientId ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    approval_prompt: "auto",
    state,
  });

  const response = NextResponse.redirect(`${STRAVA_AUTH_URL}?${params.toString()}`);
  response.cookies.set(
    STRAVA_AUTH_STATE_COOKIE_NAME,
    state,
    getStravaAuthStateCookieOptions(),
  );
  return response;
}
