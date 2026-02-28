import { NextRequest, NextResponse } from "next/server";
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
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const baseRedirect = appUrl.replace(/\/$/, "") || "http://localhost:3000";

  if (error === "access_denied") {
    return NextResponse.redirect(`${baseRedirect}/login?error=denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseRedirect}/login?error=no_code`);
  }

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseRedirect}/login?error=config`);
  }

  const redirectUri = `${baseRedirect}/api/auth/strava/callback`;
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
      return NextResponse.redirect(`${baseRedirect}/login?error=token_exchange`);
    }

    tokenData = (await tokenRes.json()) as StravaTokenResponse;
  } catch (e) {
    console.error("Strava token request error:", e);
    return NextResponse.redirect(`${baseRedirect}/login?error=token_exchange`);
  }

  const athlete = tokenData.athlete;
  if (!athlete?.id) {
    return NextResponse.redirect(`${baseRedirect}/login?error=no_athlete`);
  }

  const displayName = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || `User ${athlete.id}`;
  const iconUrl = athlete.profile ?? athlete.profile_medium ?? null;

  const supabase = getSupabaseServer();
  const { error: upsertError } = await supabase
    .from("users")
    .upsert(
      {
        strava_id: athlete.id,
        display_name: displayName,
        icon_url: iconUrl,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "strava_id",
      }
    );

  if (upsertError) {
    console.error("Supabase users upsert error:", upsertError);
    return NextResponse.redirect(`${baseRedirect}/login?error=upsert`);
  }

  return NextResponse.redirect(baseRedirect);
}
