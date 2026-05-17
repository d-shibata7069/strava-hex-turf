import { NextRequest, NextResponse } from "next/server";
import {
  generateStravaAuthState,
  getStravaAuthStateCookieOptions,
  STRAVA_AUTH_LOCALE_COOKIE_NAME,
  STRAVA_AUTH_STATE_COOKIE_NAME,
} from "@/lib/stravaAuthState";
import { routing } from "@/i18n/routing";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";

export async function GET(request: NextRequest) {
  const state = generateStravaAuthState();
  const requestedLocale = request.nextUrl.searchParams.get("locale");
  const locale =
    requestedLocale && routing.locales.includes(requestedLocale as any)
      ? requestedLocale
      : routing.defaultLocale;
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
  const cookieOptions = getStravaAuthStateCookieOptions();
  response.cookies.set(STRAVA_AUTH_STATE_COOKIE_NAME, state, cookieOptions);
  response.cookies.set(STRAVA_AUTH_LOCALE_COOKIE_NAME, locale, cookieOptions);
  return response;
}
