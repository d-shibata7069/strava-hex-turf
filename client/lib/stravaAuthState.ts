const STRAVA_AUTH_STATE_COOKIE_NAME = "strava_oauth_state";
const STRAVA_AUTH_STATE_MAX_AGE_SEC = 60 * 10; // 10分

export function generateStravaAuthState(): string {
  return crypto.randomUUID();
}

export function getStravaAuthStateCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STRAVA_AUTH_STATE_MAX_AGE_SEC,
    path: "/",
  };
}

export function getStravaAuthStateDestroyOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  maxAge: 0;
  path: string;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  };
}

export { STRAVA_AUTH_STATE_COOKIE_NAME };
