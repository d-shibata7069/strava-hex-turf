import { LoginView } from "@/components/organisms/LoginView";
import { getTranslations } from "next-intl/server";

const STRAVA_LOGIN_ROUTE = "/api/auth/strava/login";
const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";

const LOGIN_ERROR_KEYS: Record<string, string> = {
  denied: "errorDenied",
  no_code: "errorNoCode",
  config: "errorConfig",
  token_exchange: "errorTokenExchange",
  no_athlete: "errorNoAthlete",
  upsert: "errorUpsert",
  token_encryption: "errorTokenEncryption",
  state_mismatch: "errorStateMismatch",
  initial_backfill: "errorInitialBackfill",
};

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ locale }, { error }] = await Promise.all([params, searchParams]);
  const t = await getTranslations("login");
  const errorMessage =
    error && LOGIN_ERROR_KEYS[error] ? t(LOGIN_ERROR_KEYS[error]) : null;
  return (
    <LoginView
      authUrl={`${STRAVA_LOGIN_ROUTE}?locale=${encodeURIComponent(locale)}`}
      errorMessage={errorMessage}
    />
  );
}
