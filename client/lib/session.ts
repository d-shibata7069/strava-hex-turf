import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "strava_hex_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30日

interface SessionPayload {
  userId: string;
  exp: number;
}

function getSecret(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

/**
 * セッション用 JWT を発行する。Cookie にセットする文字列を返す。
 * API Route 側で NextResponse の cookies にセットすること。
 */
export async function createSessionToken(userId: string): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  return new SignJWT({ userId, exp })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .sign(secret);
}

/**
 * Cookie にセットする際のオプション。HTTP-only, Secure（本番）, SameSite を指定。
 */
export function getSessionCookieOptions(): {
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
    maxAge: SESSION_MAX_AGE_SEC,
    path: "/",
  };
}

/**
 * 現在のリクエストからセッションを検証し、ユーザーID（UUID）を返す。
 * 無効または未設定の場合は null。
 */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const { userId, exp } = payload as unknown as SessionPayload;
    if (!userId || typeof userId !== "string" || exp * 1000 < Date.now()) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}

/**
 * セッション Cookie を破棄するためのオプション。
 * API Route で response.cookies.set(SESSION_COOKIE_NAME, "", destroyOptions) のように使用する。
 */
export function getSessionDestroyOptions(): {
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

export { SESSION_COOKIE_NAME };
