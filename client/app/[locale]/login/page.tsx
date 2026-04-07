import { LoginView } from "@/components/organisms/LoginView";
import { getTranslations } from "next-intl/server";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";

const LOGIN_ERROR_KEYS: Record<string, string> = {
  denied: "errorDenied",
  no_code: "errorNoCode",
  config: "errorConfig",
  token_exchange: "errorTokenExchange",
  no_athlete: "errorNoAthlete",
  upsert: "errorUpsert",
  token_encryption: "errorTokenEncryption",
};

function buildStravaAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/strava/callback`;
  const scope = "read,activity:read_all";
  const params = new URLSearchParams({
    client_id: clientId ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    approval_prompt: "auto",
  });
  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const authUrl = buildStravaAuthUrl();
  const t = await getTranslations("login");
  const errorMessage =
    error && LOGIN_ERROR_KEYS[error] ? t(LOGIN_ERROR_KEYS[error]) : null;
  return <LoginView authUrl={authUrl} errorMessage={errorMessage} />;
}
